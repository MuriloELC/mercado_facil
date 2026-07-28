import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { ReceiptsService } from '../receipts/receipts.service';
import { parseAccessKeyFromQr } from '../shared/text.util';
import { NfceExtractionService } from './nfce-extraction.service';
import { NfcePlaywrightService } from './nfce-playwright.service';
import { NfceReference, parseNfceReference } from './nfce-reference.util';
import {
  scrapeNfceFromSefinHtml,
  ScrapedNfceData,
} from './nfce-sefin-scraper.util';

type NfceStatus =
  | 'received'
  | 'extracting_reference'
  | 'reference_extracted'
  | 'pending_review'
  | 'in_review'
  | 'extraction_failed';

type CaptchaStatus = 'not_started' | 'manual_pending' | 'resolved' | 'expired';
type ScrapingStatus =
  | 'not_started'
  | 'pending_manual_captcha'
  | 'running'
  | 'completed'
  | 'failed';

type NfceQueueRow = QueryResultRow & {
  id: string;
  user_id: string;
  receipt_id: string;
  receipt_upload_id: string | null;
  status: NfceStatus;
  extracted_type: string | null;
  extracted_value: string | null;
  extraction_method: string | null;
  extraction_attempts: number;
  last_error: string | null;
  raw_extraction_json: Record<string, unknown>;
  selected_by: string | null;
  selected_at: string | null;
  consultation_url: string | null;
  consultation_opened_at: string | null;
  captcha_status: CaptchaStatus;
  captcha_resolved_at: string | null;
  scraping_status: ScrapingStatus;
  scraping_attempts: number;
  last_scraped_at: string | null;
  scraped_data_json: Record<string, unknown>;
  mapped_manual_payload_json: Record<string, unknown>;
  processing_events_json: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
  original_filename: string | null;
  storage_path: string | null;
};

@Injectable()
export class NfceService {
  constructor(
    private readonly db: DatabaseService,
    private readonly receiptsService: ReceiptsService,
    private readonly extractionService: NfceExtractionService,
    private readonly playwrightService: NfcePlaywrightService,
  ) {}

  async intakeFromUser(
    userId: string,
    file: Express.Multer.File,
    ocrHintText?: string,
  ): Promise<NfceQueueRow> {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const receipt = await this.receiptsService.intake(
      userId,
      { source_type: 'image' },
      file,
    );

    const uploadResult = await this.db.query<
      QueryResultRow & { id: string; storage_path: string }
    >(
      `
      SELECT id, storage_path
      FROM receipt_uploads
      WHERE receipt_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [receipt.id],
    );

    const upload = uploadResult.rows[0];
    if (!upload) {
      throw new BadRequestException('Receipt upload metadata not found.');
    }

    const insertResult = await this.db.query<QueryResultRow & { id: string }>(
      `
      INSERT INTO nfce_review_items (
        user_id,
        receipt_id,
        receipt_upload_id,
        status,
        extraction_attempts
      )
      VALUES ($1, $2, $3, 'received', 0)
      RETURNING id
      `,
      [userId, receipt.id, upload.id],
    );

    const queueItemId = insertResult.rows[0].id;
    await this.appendProcessingEvent(queueItemId, 'intake_received', {
      user_id: userId,
      original_filename: file.originalname,
      mime_type: file.mimetype,
      file_size: file.size,
    });

    await this.processReferenceExtraction(queueItemId, ocrHintText);

    return this.getQueueItemById(queueItemId);
  }

  async intakeQrTextFromUser(userId: string, qrText: string): Promise<NfceQueueRow> {
    const normalizedQrText = qrText.trim();
    if (!normalizedQrText) {
      throw new BadRequestException('QR text is required.');
    }

    const reference = this.referenceFromQrText(normalizedQrText);
    const accessKey = parseAccessKeyFromQr(normalizedQrText);
    const existing = await this.findExistingUserQueueReference(
      userId,
      reference.value,
      accessKey,
    );

    if (existing) {
      return existing;
    }

    const receipt = await this.receiptsService.intake(userId, {
      source_type: 'qrcode',
      qr_text: normalizedQrText,
    });

    const existingByReceipt = await this.findQueueItemByReceiptId(receipt.id);
    if (existingByReceipt) {
      return existingByReceipt;
    }

    const insertResult = await this.db.query<QueryResultRow & { id: string }>(
      `
      INSERT INTO nfce_review_items (
        user_id,
        receipt_id,
        receipt_upload_id,
        status,
        extracted_type,
        extracted_value,
        extraction_method,
        extraction_attempts,
        raw_extraction_json
      )
      VALUES ($1, $2, NULL, 'reference_extracted', $3, $4, 'qr', 1, $5::jsonb)
      RETURNING id
      `,
      [
        userId,
        receipt.id,
        reference.type,
        reference.value,
        JSON.stringify({
          raw: reference.raw ?? normalizedQrText,
          source: 'qr_text',
          access_key: accessKey,
        }),
      ],
    );

    const queueItemId = insertResult.rows[0].id;
    await this.appendProcessingEvent(queueItemId, 'intake_received', {
      user_id: userId,
      source: 'qr_text',
    });
    await this.appendProcessingEvent(queueItemId, 'reference_extraction_completed', {
      extracted_type: reference.type,
      extraction_method: 'qr',
    });

    return this.getQueueItemById(queueItemId);
  }

  async listQueueForUser(userId: string): Promise<NfceQueueRow[]> {
    const result = await this.db.query<NfceQueueRow>(
      `
      SELECT
        nri.id,
        nri.user_id,
        nri.receipt_id,
        nri.receipt_upload_id,
        nri.status,
        nri.extracted_type,
        nri.extracted_value,
        nri.extraction_method,
        nri.extraction_attempts,
        nri.last_error,
        nri.raw_extraction_json,
        nri.selected_by,
        nri.selected_at,
        nri.consultation_url,
        nri.consultation_opened_at,
        nri.captcha_status,
        nri.captcha_resolved_at,
        nri.scraping_status,
        nri.scraping_attempts,
        nri.last_scraped_at,
        nri.scraped_data_json,
        nri.mapped_manual_payload_json,
        nri.processing_events_json,
        nri.created_at,
        nri.updated_at,
        ru.original_filename,
        ru.storage_path
      FROM nfce_review_items nri
      LEFT JOIN receipt_uploads ru ON ru.id = nri.receipt_upload_id
      WHERE nri.user_id = $1
      ORDER BY nri.created_at DESC
      LIMIT 200
      `,
      [userId],
    );

    return result.rows;
  }

  async listQueue(status?: NfceStatus): Promise<NfceQueueRow[]> {
    const result = await this.db.query<NfceQueueRow>(
      `
      SELECT
        nri.id,
        nri.user_id,
        nri.receipt_id,
        nri.receipt_upload_id,
        nri.status,
        nri.extracted_type,
        nri.extracted_value,
        nri.extraction_method,
        nri.extraction_attempts,
        nri.last_error,
        nri.raw_extraction_json,
        nri.selected_by,
        nri.selected_at,
        nri.consultation_url,
        nri.consultation_opened_at,
        nri.captcha_status,
        nri.captcha_resolved_at,
        nri.scraping_status,
        nri.scraping_attempts,
        nri.last_scraped_at,
        nri.scraped_data_json,
        nri.mapped_manual_payload_json,
        nri.processing_events_json,
        nri.created_at,
        nri.updated_at,
        ru.original_filename,
        ru.storage_path
      FROM nfce_review_items nri
      LEFT JOIN receipt_uploads ru ON ru.id = nri.receipt_upload_id
      WHERE ($1::text IS NULL OR nri.status = $1)
      ORDER BY nri.created_at DESC
      LIMIT 300
      `,
      [status ?? null],
    );

    return result.rows;
  }

  async getQueueItemById(id: string): Promise<NfceQueueRow> {
    const result = await this.db.query<NfceQueueRow>(
      `
      SELECT
        nri.id,
        nri.user_id,
        nri.receipt_id,
        nri.receipt_upload_id,
        nri.status,
        nri.extracted_type,
        nri.extracted_value,
        nri.extraction_method,
        nri.extraction_attempts,
        nri.last_error,
        nri.raw_extraction_json,
        nri.selected_by,
        nri.selected_at,
        nri.consultation_url,
        nri.consultation_opened_at,
        nri.captcha_status,
        nri.captcha_resolved_at,
        nri.scraping_status,
        nri.scraping_attempts,
        nri.last_scraped_at,
        nri.scraped_data_json,
        nri.mapped_manual_payload_json,
        nri.processing_events_json,
        nri.created_at,
        nri.updated_at,
        ru.original_filename,
        ru.storage_path
      FROM nfce_review_items nri
      LEFT JOIN receipt_uploads ru ON ru.id = nri.receipt_upload_id
      WHERE nri.id = $1
      LIMIT 1
      `,
      [id],
    );

    const item = result.rows[0];
    if (!item) {
      throw new NotFoundException('Queue item not found.');
    }

    return item;
  }

  private async findQueueItemByReceiptId(
    receiptId: string,
  ): Promise<NfceQueueRow | null> {
    const result = await this.db.query<QueryResultRow & { id: string }>(
      `
      SELECT id
      FROM nfce_review_items
      WHERE receipt_id = $1
      LIMIT 1
      `,
      [receiptId],
    );

    const id = result.rows[0]?.id;
    return id ? this.getQueueItemById(id) : null;
  }

  private async findExistingUserQueueReference(
    userId: string,
    extractedValue: string,
    accessKey: string | null,
  ): Promise<NfceQueueRow | null> {
    const result = await this.db.query<QueryResultRow & { id: string }>(
      `
      SELECT nri.id
      FROM nfce_review_items nri
      LEFT JOIN receipts r ON r.id = nri.receipt_id
      WHERE nri.user_id = $1
        AND (
          nri.extracted_value = $2
          OR ($3::text IS NOT NULL AND nri.extracted_value = $3)
          OR ($3::text IS NOT NULL AND r.access_key = $3)
        )
      ORDER BY nri.created_at DESC
      LIMIT 1
      `,
      [userId, extractedValue, accessKey],
    );

    const id = result.rows[0]?.id;
    return id ? this.getQueueItemById(id) : null;
  }

  private referenceFromQrText(qrText: string): NfceReference {
    const parsed = parseNfceReference(qrText);
    if (parsed) {
      return {
        ...parsed,
        method: 'qr',
        raw: parsed.raw ?? qrText,
      };
    }

    return {
      type: 'qrcode',
      value: qrText,
      method: 'qr',
      raw: qrText,
    };
  }

  async markInReview(id: string, adminUserId: string): Promise<NfceQueueRow> {
    const updated = await this.db.query<QueryResultRow & { id: string }>(
      `
      UPDATE nfce_review_items
      SET
        status = 'in_review',
        selected_by = $2,
        selected_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [id, adminUserId],
    );

    if (!updated.rows[0]) {
      throw new NotFoundException('Queue item not found for review selection.');
    }

    await this.appendProcessingEvent(id, 'selected_for_review', {
      selected_by: adminUserId,
    });

    return this.getQueueItemById(id);
  }

  async startAssistedConsultation(id: string, adminUserId: string) {
    const item = await this.getQueueItemById(id);
    const consultationUrl = this.resolveConsultationUrl(item);

    if (!consultationUrl) {
      throw new BadRequestException(
        'Could not resolve consultation URL from extracted NFC-e reference.',
      );
    }

    await this.db.query(
      `
      UPDATE nfce_review_items
      SET
        status = 'in_review',
        selected_by = $2,
        selected_at = COALESCE(selected_at, NOW()),
        consultation_url = $3,
        consultation_opened_at = NOW(),
        captcha_status = 'manual_pending',
        scraping_status = 'pending_manual_captcha',
        updated_at = NOW()
      WHERE id = $1
      `,
      [id, adminUserId, consultationUrl],
    );

    await this.appendProcessingEvent(id, 'consultation_started', {
      selected_by: adminUserId,
      consultation_url: consultationUrl,
    });

    const updated = await this.getQueueItemById(id);

    return {
      consultation_url: consultationUrl,
      item: updated,
    };
  }
  async startPlaywrightAssistedSession(id: string, adminUserId: string) {
    const started = await this.startAssistedConsultation(id, adminUserId);
    const session = await this.playwrightService.startSession(
      id,
      started.consultation_url,
      adminUserId,
    );

    await this.appendProcessingEvent(id, 'playwright_session_started', {
      selected_by: adminUserId,
      consultation_url: started.consultation_url,
    });

    return {
      ...started,
      playwright: session,
    };
  }

  async getPlaywrightSessionState(id: string) {
    await this.getQueueItemById(id);
    return this.playwrightService.getSessionState(id);
  }

  async scrapeFromPlaywrightSession(id: string, adminUserId: string) {
    const capture = await this.playwrightService.captureHtml(id);

    const result = await this.scrapeAfterManualCaptcha(id, adminUserId, capture.html);

    await this.appendProcessingEvent(id, 'playwright_scrape_captured', {
      selected_by: adminUserId,
      current_url: capture.current_url,
      title: capture.title,
      html_length: capture.html.length,
    });

    return {
      ...result,
      playwright: {
        current_url: capture.current_url,
        title: capture.title,
        html_length: capture.html.length,
      },
    };
  }

  async closePlaywrightSession(id: string) {
    await this.playwrightService.closeSession(id);

    await this.appendProcessingEvent(id, 'playwright_session_closed', {});

    return {
      queue_item_id: id,
      closed: true,
    };
  }
  async scrapeAfterManualCaptcha(
    id: string,
    adminUserId: string,
    pageHtmlOrUrl?: string,
  ): Promise<{ item: NfceQueueRow; prefill: Record<string, unknown> }> {
    const current = await this.getQueueItemById(id);
    const consultationUrl =
      current.consultation_url ?? this.resolveConsultationUrl(current);

    if (!consultationUrl && !pageHtmlOrUrl) {
      throw new BadRequestException(
        'No consultation URL available for scraping. Provide page_html manually.',
      );
    }

    await this.db.query(
      `
      UPDATE nfce_review_items
      SET
        status = 'in_review',
        selected_by = $2,
        selected_at = COALESCE(selected_at, NOW()),
        captcha_status = 'resolved',
        captcha_resolved_at = NOW(),
        scraping_status = 'running',
        scraping_attempts = scraping_attempts + 1,
        last_error = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [id, adminUserId],
    );

    await this.appendProcessingEvent(id, 'scraping_started', {
      selected_by: adminUserId,
      source: pageHtmlOrUrl ? 'page_input' : 'consultation_fetch',
      consultation_url: consultationUrl,
    });

    try {
      const input = (pageHtmlOrUrl ?? '').trim();
      const inputLooksLikeUrl = this.looksLikeUrl(input);
      const html = input
        ? inputLooksLikeUrl
          ? await this.fetchConsultationHtml(input)
          : input
        : await this.fetchConsultationHtml(consultationUrl as string);

      const scrapeResult = scrapeNfceFromSefinHtml(html, consultationUrl ?? undefined);
      if (scrapeResult.captchaRequired) {
        await this.db.query(
          `
          UPDATE nfce_review_items
          SET
            captcha_status = 'expired',
            scraping_status = 'failed',
            last_error = 'Captcha not resolved or expired for consultation page.',
            updated_at = NOW()
          WHERE id = $1
          `,
          [id],
        );

        await this.appendProcessingEvent(id, 'scraping_failed_captcha', {
          diagnostics: scrapeResult.diagnostics,
        });

        throw new BadRequestException(
          inputLooksLikeUrl
            ? 'Captcha ainda exigido. URL sozinha normalmente nao carrega a sessao resolvida do captcha. Cole o HTML da pagina liberada (Ctrl+U) e tente novamente.'
            : 'Captcha still required/expired. Resolve captcha again and retry scraping.',
        );
      }

      const scraped = scrapeResult.data;
      if (!scraped) {
        throw new BadRequestException('Unable to extract NFC-e data from consultation page.');
      }

      const mapped = this.buildManualPrefill(scraped);
      await this.persistScrapedData(id, current.receipt_id, scraped, mapped);

      await this.appendProcessingEvent(id, 'scraping_completed', {
        item_count: mapped.items.length,
        has_total: Boolean(mapped.total_amount),
        has_purchase_date: Boolean(mapped.purchase_date),
      });

      const item = await this.getQueueItemById(id);
      return {
        item,
        prefill: mapped,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown scraping error';

      await this.db.query(
        `
        UPDATE nfce_review_items
        SET
          scraping_status = 'failed',
          last_error = $2,
          updated_at = NOW()
        WHERE id = $1
        `,
        [id, message],
      );

      await this.appendProcessingEvent(id, 'scraping_failed', {
        error: message,
      });

      throw error;
    }
  }

  async getManualPrefill(id: string): Promise<Record<string, unknown>> {
    const item = await this.getQueueItemById(id);
    const mapped = item.mapped_manual_payload_json ?? {};

    return {
      queue_item_id: id,
      receipt_id: item.receipt_id,
      prefill: mapped,
      scraping_status: item.scraping_status,
      captcha_status: item.captcha_status,
      last_error: item.last_error,
      last_scraped_at: item.last_scraped_at,
    };
  }

  async retryReferenceExtraction(
    id: string,
    ocrHintText?: string,
  ): Promise<NfceQueueRow> {
    await this.processReferenceExtraction(id, ocrHintText);
    return this.getQueueItemById(id);
  }

  private async processReferenceExtraction(
    queueItemId: string,
    ocrHintText?: string,
  ): Promise<void> {
    const item = await this.getQueueItemById(queueItemId);

    if (!item.storage_path) {
      await this.db.query(
        `
        UPDATE nfce_review_items
        SET
          status = 'extraction_failed',
          extraction_attempts = extraction_attempts + 1,
          last_error = 'Missing image path in receipt_uploads',
          updated_at = NOW()
        WHERE id = $1
        `,
        [queueItemId],
      );

      await this.appendProcessingEvent(queueItemId, 'reference_extraction_failed', {
        error: 'Missing image path in receipt_uploads',
      });
      return;
    }

    await this.db.query(
      `
      UPDATE nfce_review_items
      SET
        status = 'extracting_reference',
        extraction_attempts = extraction_attempts + 1,
        last_error = NULL,
        updated_at = NOW()
      WHERE id = $1
      `,
      [queueItemId],
    );

    try {
      const extraction = await this.extractionService.extractReferenceFromImage(
        item.storage_path,
        ocrHintText,
      );

      if (!extraction.reference) {
        await this.db.query(
          `
          UPDATE nfce_review_items
          SET
            status = 'pending_review',
            extracted_type = NULL,
            extracted_value = NULL,
            extraction_method = NULL,
            raw_extraction_json = $2::jsonb,
            scraping_status = 'not_started',
            updated_at = NOW()
          WHERE id = $1
          `,
          [queueItemId, JSON.stringify(extraction.diagnostics)],
        );

        await this.appendProcessingEvent(queueItemId, 'reference_extraction_no_match', {
          diagnostics: extraction.diagnostics,
        });
        return;
      }

      await this.db.query(
        `
        UPDATE nfce_review_items
        SET
          status = 'reference_extracted',
          extracted_type = $2,
          extracted_value = $3,
          extraction_method = $4,
          raw_extraction_json = $5::jsonb,
          scraping_status = 'not_started',
          updated_at = NOW()
        WHERE id = $1
        `,
        [
          queueItemId,
          extraction.reference.type,
          extraction.reference.value,
          extraction.reference.method,
          JSON.stringify({
            diagnostics: extraction.diagnostics,
            raw: extraction.reference.raw ?? null,
          }),
        ],
      );

      await this.appendProcessingEvent(queueItemId, 'reference_extraction_completed', {
        extracted_type: extraction.reference.type,
        extraction_method: extraction.reference.method,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown extraction error';
      await this.db.query(
        `
        UPDATE nfce_review_items
        SET
          status = 'extraction_failed',
          last_error = $2,
          updated_at = NOW()
        WHERE id = $1
        `,
        [queueItemId, message],
      );

      await this.appendProcessingEvent(queueItemId, 'reference_extraction_failed', {
        error: message,
      });
    }
  }

  private resolveConsultationUrl(item: NfceQueueRow): string | null {
    const value = item.extracted_value?.trim();
    if (!value) {
      return null;
    }

    if (item.extracted_type === 'url' || item.extracted_type === 'qrcode') {
      if (/^https?:\/\//i.test(value)) {
        return value;
      }
    }

    if (item.extracted_type === 'access_key') {
      const template = process.env.SEFAZ_NFCE_ACCESS_KEY_URL_TEMPLATE;
      if (template?.includes('{ACCESS_KEY}')) {
        return template.replace('{ACCESS_KEY}', value);
      }
    }

    return null;
  }

  private async fetchConsultationHtml(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Consultation request failed with status ${response.status}.`,
        );
      }

      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }
  private looksLikeUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
  }
  private buildManualPrefill(scraped: ScrapedNfceData) {
    const marketName = scraped.market_name ?? scraped.market_legal_name;
    const items = (scraped.items ?? [])
      .filter((item) => item.raw_description)
      .map((item) => ({
        raw_description: item.raw_description,
        quantity: item.quantity && item.quantity > 0 ? item.quantity : 1,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
        alias_text: item.raw_description,
      }));

    return {
      source: {
        access_key: scraped.access_key,
        consultation_url: scraped.consultation_url,
        nfce_number: scraped.nfce_number,
        nfce_series: scraped.nfce_series,
        authorization_protocol: scraped.authorization_protocol,
        authorization_date: scraped.authorization_date,
      },
      market: marketName
        ? {
            name: marketName,
            city: scraped.market_city ?? '',
            state_code: scraped.market_state_code,
            neighborhood: scraped.market_neighborhood,
            address_line: scraped.market_address_line,
            cnpj: scraped.market_cnpj,
            postal_code: scraped.market_postal_code,
          }
        : null,
      purchase_date: scraped.purchase_date,
      total_amount: scraped.total_amount,
      total_taxes_amount: scraped.total_taxes_amount,
      items,
    };
  }

  private async persistScrapedData(
    queueItemId: string,
    receiptId: string,
    scraped: ScrapedNfceData,
    mapped: Record<string, unknown>,
  ): Promise<void> {
    let duplicateReceiptId: string | null = null;
    if (scraped.access_key) {
      const existing = await this.db.query<QueryResultRow & { id: string }>(
        `
        SELECT id
        FROM receipts
        WHERE access_key = $1
          AND id <> $2
        LIMIT 1
        `,
        [scraped.access_key, receiptId],
      );
      duplicateReceiptId = existing.rows[0]?.id ?? null;
    }

    await this.db.query(
      `
      UPDATE nfce_review_items
      SET
        status = 'pending_review',
        scraping_status = 'completed',
        last_scraped_at = NOW(),
        scraped_data_json = $2::jsonb,
        mapped_manual_payload_json = $3::jsonb,
        consultation_url = COALESCE(consultation_url, $4),
        updated_at = NOW()
      WHERE id = $1
      `,
      [
        queueItemId,
        JSON.stringify(scraped),
        JSON.stringify({
          ...mapped,
          duplicate_of_receipt_id: duplicateReceiptId,
        }),
        scraped.consultation_url ?? null,
      ],
    );

    await this.db.query(
      `
      UPDATE receipts
      SET
        access_key = CASE
          WHEN $2::text IS NULL THEN access_key
          WHEN $6::uuid IS NULL THEN COALESCE($2::text, access_key)
          ELSE access_key
        END,
        purchase_date = COALESCE($3::timestamptz, purchase_date),
        total_amount = COALESCE($4::numeric, total_amount),
        nfce_number = COALESCE($7::text, nfce_number),
        nfce_series = COALESCE($8::text, nfce_series),
        authorization_protocol = COALESCE($9::text, authorization_protocol),
        authorization_date = COALESCE($10::timestamptz, authorization_date),
        total_taxes_amount = COALESCE($11::numeric, total_taxes_amount),
        raw_payload = COALESCE(raw_payload, '{}'::jsonb) || jsonb_build_object(
          'nfce_scraped',
          $5::jsonb,
          'duplicate_of_receipt_id',
          $6
        )
      WHERE id = $1
      `,
      [
        receiptId,
        scraped.access_key ?? null,
        scraped.purchase_date ?? null,
        scraped.total_amount ?? null,
        JSON.stringify(scraped),
        duplicateReceiptId,
        scraped.nfce_number ?? null,
        scraped.nfce_series ?? null,
        scraped.authorization_protocol ?? null,
        scraped.authorization_date ?? null,
        scraped.total_taxes_amount ?? null,
      ],
    );

    if (duplicateReceiptId) {
      await this.appendProcessingEvent(queueItemId, 'duplicate_access_key_detected', {
        duplicate_of_receipt_id: duplicateReceiptId,
        access_key: scraped.access_key,
      });
    }
  }
  private async appendProcessingEvent(
    queueItemId: string,
    event: string,
    meta: Record<string, unknown> = {},
  ): Promise<void> {
    const payload = {
      at: new Date().toISOString(),
      event,
      ...meta,
    };

    await this.db.query(
      `
      UPDATE nfce_review_items
      SET
        processing_events_json = COALESCE(processing_events_json, '[]'::jsonb) || jsonb_build_array($2::jsonb),
        updated_at = NOW()
      WHERE id = $1
      `,
      [queueItemId, JSON.stringify(payload)],
    );
  }
}
