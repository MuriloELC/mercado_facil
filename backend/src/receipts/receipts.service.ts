import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { PoolClient } from 'pg';
import { DatabaseService } from '../database/database.service';
import { MarketsService } from '../markets/markets.service';
import { PricingService } from '../pricing/pricing.service';
import { ProductsService } from '../products/products.service';
import { normalizeText, parseAccessKeyFromQr } from '../shared/text.util';
import { IntakeReceiptDto } from './dto/intake-receipt.dto';
import { ListReceiptsDto } from './dto/list-receipts.dto';
import { ManualProcessReceiptDto } from './dto/manual-process-receipt.dto';

type ReceiptStatus =
  | 'pending'
  | 'in_review'
  | 'processed'
  | 'failed'
  | 'duplicate';

type ReceiptListRow = {
  id: string;
  source_type: string;
  access_key: string | null;
  purchase_date: string | null;
  total_amount: string | null;
  status: ReceiptStatus;
  created_at: string;
  processed_at: string | null;
  market_id: string | null;
  market_name: string | null;
  market_city: string | null;
  upload_count: string;
};

type ReceiptDetailRow = {
  id: string;
  user_id: string;
  market_id: string | null;
  market_name: string | null;
  market_city: string | null;
  source_type: string;
  access_key: string | null;
  raw_payload: Record<string, unknown>;
  purchase_date: string | null;
  total_amount: string | null;
  status: ReceiptStatus;
  payload_hash: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
};

type UploadRow = {
  id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size: string | null;
  file_hash: string | null;
  created_at: string;
};

type ReceiptItemRow = {
  id: string;
  raw_description: string;
  quantity: string;
  unit: string | null;
  unit_price: string | null;
  total_price: string | null;
  confidence_score: string | null;
  classification_source: 'manual' | 'rag_confirmed' | null;
  canonical_product_id: string | null;
  canonical_name: string | null;
};

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly marketsService: MarketsService,
    private readonly productsService: ProductsService,
    private readonly pricingService: PricingService,
  ) {}

  async intake(
    userId: string,
    dto: IntakeReceiptDto,
    file?: Express.Multer.File,
  ) {
    const qrText = dto.qr_text?.trim() || null;
    const accessKey = parseAccessKeyFromQr(qrText ?? undefined);
    const sourceType = dto.source_type ?? (file ? 'image' : qrText ? 'qrcode' : 'manual');

    if (!file && !qrText) {
      throw new BadRequestException('You must provide qr_text or an image file.');
    }

    const payload = {
      qr_text: qrText,
      source_type: sourceType,
      image: file
        ? {
            filename: file.filename,
            mimetype: file.mimetype,
            size: file.size,
          }
        : null,
    };

    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    if (accessKey) {
      const existing = await this.db.query<{ id: string }>(
        `
        SELECT id
        FROM receipts
        WHERE access_key = $1
        LIMIT 1
        `,
        [accessKey],
      );

      if (existing.rows[0]) {
        await this.db.query(
          `
          UPDATE receipts
          SET status = 'duplicate',
              processed_at = NOW(),
              processed_by = $2
          WHERE id = $1
          `,
          [existing.rows[0].id, userId],
        );

        return this.getById(existing.rows[0].id);
      }
    }

    const inserted = await this.db.query<{ id: string }>(
      `
      INSERT INTO receipts (
        user_id,
        source_type,
        access_key,
        raw_payload,
        status,
        payload_hash
      )
      VALUES ($1, $2, $3, $4::jsonb, 'pending', $5)
      RETURNING id
      `,
      [userId, sourceType, accessKey, JSON.stringify(payload), payloadHash],
    );

    const receiptId = inserted.rows[0].id;

    if (file) {
      const fileHash = this.calculateFileHash(file.path);
      await this.db.query(
        `
        INSERT INTO receipt_uploads (
          receipt_id,
          storage_path,
          original_filename,
          mime_type,
          file_size,
          file_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          receiptId,
          file.path,
          file.originalname,
          file.mimetype,
          file.size,
          fileHash,
        ],
      );
    }

    return this.getById(receiptId);
  }

  async list(query: ListReceiptsDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const result = await this.db.query<ReceiptListRow>(
      `
      SELECT
        r.id,
        r.source_type,
        r.access_key,
        r.purchase_date,
        r.total_amount,
        r.status,
        r.created_at,
        r.processed_at,
        r.market_id,
        m.name AS market_name,
        m.city AS market_city,
        COUNT(ru.id)::text AS upload_count
      FROM receipts r
      LEFT JOIN markets m ON m.id = r.market_id
      LEFT JOIN receipt_uploads ru ON ru.receipt_id = r.id
      WHERE ($1::text IS NULL OR r.status = $1)
        AND ($2::text IS NULL
             OR r.access_key ILIKE ('%' || $2 || '%')
             OR m.name ILIKE ('%' || $2 || '%')
             OR m.city ILIKE ('%' || $2 || '%'))
        AND ($3::uuid IS NULL OR r.market_id = $3)
        AND ($4::timestamptz IS NULL OR r.created_at >= $4)
        AND ($5::timestamptz IS NULL OR r.created_at <= $5)
      GROUP BY r.id, m.name, m.city
      ORDER BY r.created_at DESC
      LIMIT $6
      OFFSET $7
      `,
      [
        query.status ?? null,
        query.search ?? null,
        query.market_id ?? null,
        query.from ?? null,
        query.to ?? null,
        limit,
        offset,
      ],
    );

    return result.rows;
  }

  async getById(receiptId: string) {
    const receiptResult = await this.db.query<ReceiptDetailRow>(
      `
      SELECT
        r.id,
        r.user_id,
        r.market_id,
        m.name AS market_name,
        m.city AS market_city,
        r.source_type,
        r.access_key,
        r.raw_payload,
        r.purchase_date,
        r.total_amount,
        r.status,
        r.payload_hash,
        r.created_at,
        r.processed_at,
        r.processed_by
      FROM receipts r
      LEFT JOIN markets m ON m.id = r.market_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [receiptId],
    );

    const receipt = receiptResult.rows[0];
    if (!receipt) {
      throw new NotFoundException(`Receipt ${receiptId} was not found.`);
    }

    const [uploadsResult, itemsResult] = await Promise.all([
      this.db.query<UploadRow>(
        `
        SELECT id, storage_path, original_filename, mime_type, file_size, file_hash, created_at
        FROM receipt_uploads
        WHERE receipt_id = $1
        ORDER BY created_at DESC
        `,
        [receiptId],
      ),
      this.db.query<ReceiptItemRow>(
        `
        SELECT
          ri.id,
          ri.raw_description,
          ri.quantity,
          ri.unit,
          ri.unit_price,
          ri.total_price,
          ri.confidence_score,
          ri.classification_source,
          ri.canonical_product_id,
          cp.canonical_name
        FROM receipt_items ri
        LEFT JOIN canonical_products cp ON cp.id = ri.canonical_product_id
        WHERE ri.receipt_id = $1
        ORDER BY ri.created_at ASC
        `,
        [receiptId],
      ),
    ]);

    return {
      ...receipt,
      uploads: uploadsResult.rows,
      items: itemsResult.rows,
    };
  }

  async claim(receiptId: string, userId: string) {
    const result = await this.db.query<{ id: string }>(
      `
      UPDATE receipts
      SET status = 'in_review',
          processed_by = $2
      WHERE id = $1
        AND status IN ('pending', 'in_review')
      RETURNING id
      `,
      [receiptId, userId],
    );

    if (!result.rows[0]) {
      throw new BadRequestException(
        'Receipt cannot be claimed because it is not pending/in_review.',
      );
    }

    return this.getById(receiptId);
  }

  async markFailed(receiptId: string, userId: string) {
    return this.markStatus(receiptId, 'failed', userId);
  }

  async markDuplicate(receiptId: string, userId: string) {
    return this.markStatus(receiptId, 'duplicate', userId);
  }

  async manualProcess(
    receiptId: string,
    userId: string,
    dto: ManualProcessReceiptDto,
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one receipt item is required.');
    }

    await this.db.withTransaction(async (client) => {
      const receiptResult = await client.query<{ id: string }>(
        `SELECT id FROM receipts WHERE id = $1 FOR UPDATE`,
        [receiptId],
      );

      if (!receiptResult.rows[0]) {
        throw new NotFoundException(`Receipt ${receiptId} was not found.`);
      }

      const marketId = await this.resolveMarket(client, dto);
      const purchaseDate = dto.purchase_date ?? new Date().toISOString();

      await client.query(
        `
        UPDATE receipts
        SET market_id = $2,
            purchase_date = $3,
            total_amount = COALESCE($4, total_amount),
            status = 'in_review',
            processed_by = $5
        WHERE id = $1
        `,
        [receiptId, marketId, purchaseDate, dto.total_amount ?? null, userId],
      );

      // Idempotency: recreates all items/observations for this receipt.
      await client.query(`DELETE FROM receipt_items WHERE receipt_id = $1`, [receiptId]);

      for (const item of dto.items) {
        if (item.quantity <= 0) {
          throw new BadRequestException('Item quantity must be greater than zero.');
        }

        const canonicalProductId = await this.resolveCanonicalProductId(client, item);
        if (
          item.classification_source === 'rag_confirmed' &&
          !item.canonical_product_id
        ) {
          throw new BadRequestException(
            'rag_confirmed classification requires canonical_product_id.',
          );
        }
        const unitPrice = item.unit_price ?? null;
        const totalPrice = item.total_price ?? null;

        if (unitPrice !== null && unitPrice <= 0) {
          throw new BadRequestException('Item unit_price must be greater than zero.');
        }

        if (totalPrice !== null && totalPrice <= 0) {
          throw new BadRequestException('Item total_price must be greater than zero.');
        }

        const insertedItem = await client.query<{ id: string }>(
          `
          INSERT INTO receipt_items (
            receipt_id,
            raw_description,
            canonical_product_id,
            quantity,
            unit,
            unit_price,
            total_price,
            confidence_score,
            classification_source
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
          `,
          [
            receiptId,
            item.raw_description,
            canonicalProductId,
            item.quantity,
            item.unit ?? null,
            unitPrice,
            totalPrice,
            canonicalProductId
              ? (item.classification_confidence ?? 1)
              : null,
            canonicalProductId
              ? (item.classification_source ?? 'manual')
              : null,
          ],
        );

        if (canonicalProductId) {
          const alias = item.alias_text ?? item.raw_description;
          await this.productsService.upsertAlias(
            canonicalProductId,
            alias,
            item.classification_source === 'rag_confirmed' ? 'rag_confirmed' : 'manual',
            client,
          );

          const observedPrice =
            unitPrice ??
            (totalPrice && item.quantity > 0 ? totalPrice / item.quantity : null);

          if (observedPrice && observedPrice > 0) {
            await this.pricingService.createObservation(client, {
              canonicalProductId,
              marketId,
              receiptItemId: insertedItem.rows[0].id,
              observedPrice,
              observedAt: purchaseDate,
            });
          }
        }
      }

      await client.query(
        `
        UPDATE receipts
        SET status = 'processed',
            processed_at = NOW(),
            processed_by = $2
        WHERE id = $1
        `,
        [receiptId, userId],
      );
    });

    return this.getById(receiptId);
  }

  private async markStatus(
    receiptId: string,
    status: ReceiptStatus,
    userId: string,
  ) {
    const result = await this.db.query<{ id: string }>(
      `
      UPDATE receipts
      SET status = $2,
          processed_at = NOW(),
          processed_by = $3
      WHERE id = $1
      RETURNING id
      `,
      [receiptId, status, userId],
    );

    if (!result.rows[0]) {
      throw new NotFoundException(`Receipt ${receiptId} was not found.`);
    }

    return this.getById(receiptId);
  }

  private async resolveMarket(
    client: PoolClient,
    dto: ManualProcessReceiptDto,
  ): Promise<string> {
    if (dto.market_id) {
      await this.marketsService.findById(dto.market_id, client);
      return dto.market_id;
    }

    if (dto.market) {
      const created = await this.marketsService.create(dto.market, client);
      return created.id;
    }

    throw new BadRequestException(
      'market_id or market object is required for manual processing.',
    );
  }

  private async resolveCanonicalProductId(
    client: PoolClient,
    item: ManualProcessReceiptDto['items'][number],
  ): Promise<string | null> {
    if (item.canonical_product_id) {
      await this.productsService.findById(item.canonical_product_id, client);
      return item.canonical_product_id;
    }

    if (item.canonical_product) {
      const created = await this.productsService.create(item.canonical_product, client);
      return created.id;
    }

    const seedAlias = item.alias_text ?? item.raw_description;
    const normalizedAlias = normalizeText(seedAlias);
    if (!normalizedAlias) {
      return null;
    }

    const matched = await this.productsService.findByNormalizedAlias(
      normalizedAlias,
      client,
    );

    return matched?.id ?? null;
  }

  private calculateFileHash(filePath: string): string {
    const bytes = readFileSync(filePath);
    return createHash('sha256').update(bytes).digest('hex');
  }
}
