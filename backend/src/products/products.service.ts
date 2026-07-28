import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { slugify, normalizeText } from '../shared/text.util';
import { CreateProductDto } from './dto/create-product.dto';

type DbExecutor = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

type CanonicalProductRow = {
  id: string;
  slug: string;
  canonical_name: string;
  category: string | null;
  brand: string | null;
  package_size: number | null;
  package_unit: string | null;
  attributes_json: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

@Injectable()
export class ProductsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(search?: string, limit = 50): Promise<CanonicalProductRow[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const result = await this.db.query<CanonicalProductRow>(
      `
      SELECT id, slug, canonical_name, category, brand, package_size, package_unit,
             attributes_json, is_active, created_at
      FROM canonical_products
      WHERE ($1::text IS NULL
          OR canonical_name ILIKE ('%' || $1 || '%')
          OR slug ILIKE ('%' || $1 || '%'))
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [search ?? null, safeLimit],
    );

    return result.rows;
  }

  async findById(id: string, client?: PoolClient): Promise<CanonicalProductRow> {
    const runner = this.getRunner(client);
    const result = await runner.query<CanonicalProductRow>(
      `
      SELECT id, slug, canonical_name, category, brand, package_size, package_unit,
             attributes_json, is_active, created_at
      FROM canonical_products
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const product = result.rows[0];
    if (!product) {
      throw new NotFoundException(`Canonical product ${id} was not found.`);
    }

    return product;
  }

  async create(
    dto: CreateProductDto,
    client?: PoolClient,
  ): Promise<CanonicalProductRow> {
    const runner = this.getRunner(client);
    const slug = await this.generateUniqueSlug(dto.slug ?? dto.canonical_name, runner);

    const result = await runner.query<CanonicalProductRow>(
      `
      INSERT INTO canonical_products (
        slug,
        canonical_name,
        category,
        brand,
        package_size,
        package_unit,
        attributes_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, slug, canonical_name, category, brand, package_size,
                package_unit, attributes_json, is_active, created_at
      `,
      [
        slug,
        dto.canonical_name,
        dto.category ?? null,
        dto.brand ?? null,
        dto.package_size ?? null,
        dto.package_unit ?? null,
        JSON.stringify(dto.attributes_json ?? {}),
      ],
    );

    return result.rows[0];
  }

  async findByNormalizedAlias(
    normalizedAlias: string,
    client?: PoolClient,
  ): Promise<CanonicalProductRow | null> {
    const runner = this.getRunner(client);
    const result = await runner.query<CanonicalProductRow>(
      `
      SELECT cp.id, cp.slug, cp.canonical_name, cp.category, cp.brand,
             cp.package_size, cp.package_unit, cp.attributes_json,
             cp.is_active, cp.created_at
      FROM product_aliases pa
      JOIN canonical_products cp ON cp.id = pa.canonical_product_id
      WHERE pa.normalized_alias = $1
      LIMIT 1
      `,
      [normalizedAlias],
    );

    return result.rows[0] ?? null;
  }

  async upsertAlias(
    canonicalProductId: string,
    aliasText: string,
    source = 'manual',
    client?: PoolClient,
  ): Promise<void> {
    const normalizedAlias = normalizeText(aliasText);
    if (!normalizedAlias) {
      return;
    }

    const runner = this.getRunner(client);
    await runner.query(
      `
      INSERT INTO product_aliases (
        canonical_product_id,
        alias_text,
        normalized_alias,
        source
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (canonical_product_id, normalized_alias)
      DO UPDATE SET
        alias_text = EXCLUDED.alias_text,
        source = EXCLUDED.source
      `,
      [canonicalProductId, aliasText, normalizedAlias, source],
    );
  }

  private getRunner(client?: PoolClient): DbExecutor {
    return client ?? this.db;
  }

  private async generateUniqueSlug(seed: string, runner: DbExecutor): Promise<string> {
    const base = slugify(seed) || 'produto';
    let candidate = base;
    let counter = 1;

    while (true) {
      const exists = await runner.query<{ id: string }>(
        `SELECT id FROM canonical_products WHERE slug = $1 LIMIT 1`,
        [candidate],
      );

      if (exists.rowCount === 0) {
        return candidate;
      }

      counter += 1;
      candidate = `${base}-${counter}`;
    }
  }
}
