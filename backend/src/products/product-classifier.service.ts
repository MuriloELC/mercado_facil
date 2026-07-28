import {
  GatewayTimeoutException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

export type ProductClassificationInput = {
  raw_description: string;
  ncm?: string;
  unit?: string;
  brand?: string;
  top_k?: number;
};

export type ProductClassificationCandidate = {
  canonical_product_id: string;
  canonical_name: string;
  similarity: number;
  confidence: number;
  reason: string;
  metadata: Record<string, unknown>;
};

export type ProductClassificationResponse = {
  normalized_description: string;
  candidates: ProductClassificationCandidate[];
  needs_human_review: true;
  models: {
    embedding: string;
    chat: string;
  };
};

@Injectable()
export class ProductClassifierService {
  async classify(
    input: ProductClassificationInput,
  ): Promise<ProductClassificationResponse> {
    const baseUrl = (process.env.RAG_API_URL ?? 'http://localhost:8001').replace(
      /\/$/,
      '',
    );
    const configuredTimeout = Number(process.env.RAG_TIMEOUT_MS ?? 30000);
    const timeoutMs = Number.isFinite(configuredTimeout)
      ? Math.max(configuredTimeout, 1000)
      : 30000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${baseUrl}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: input.raw_description,
          ncm: input.ncm,
          unit: input.unit,
          brand: input.brand,
          top_k: input.top_k ?? 5,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(
          `Product classifier is unavailable (HTTP ${response.status}).`,
        );
      }

      const payload = (await response.json()) as ProductClassificationResponse;
      if (!Array.isArray(payload.candidates)) {
        throw new ServiceUnavailableException(
          'Product classifier returned an invalid response.',
        );
      }

      return payload;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new GatewayTimeoutException('Product classifier timed out.');
      }

      throw new ServiceUnavailableException(
        'Product classifier is unavailable. Manual review remains available.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
