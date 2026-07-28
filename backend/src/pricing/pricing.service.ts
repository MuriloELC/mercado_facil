import { Injectable } from '@nestjs/common';
import { PoolClient } from 'pg';

export type PriceObservationInput = {
  canonicalProductId: string;
  marketId: string;
  receiptItemId: string;
  observedPrice: number;
  observedAt: string;
};

@Injectable()
export class PricingService {
  async createObservation(
    client: PoolClient,
    input: PriceObservationInput,
  ): Promise<void> {
    await client.query(
      `
      INSERT INTO price_observations (
        canonical_product_id,
        market_id,
        receipt_item_id,
        observed_price,
        observed_at
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (receipt_item_id)
      DO UPDATE SET
        observed_price = EXCLUDED.observed_price,
        observed_at = EXCLUDED.observed_at,
        market_id = EXCLUDED.market_id,
        canonical_product_id = EXCLUDED.canonical_product_id
      `,
      [
        input.canonicalProductId,
        input.marketId,
        input.receiptItemId,
        input.observedPrice,
        input.observedAt,
      ],
    );
  }
}
