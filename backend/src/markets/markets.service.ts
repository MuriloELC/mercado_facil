import { Injectable, NotFoundException } from '@nestjs/common';
import { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { DatabaseService } from '../database/database.service';
import { CreateMarketDto } from './dto/create-market.dto';

type DbExecutor = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
};

type MarketRow = {
  id: string;
  name: string;
  chain_name: string | null;
  cnpj: string | null;
  city: string;
  state_code: string | null;
  neighborhood: string | null;
  address_line: string | null;
  postal_code: string | null;
  latitude: string | null;
  longitude: string | null;
  created_at: string;
};

@Injectable()
export class MarketsService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(search?: string, limit = 50): Promise<MarketRow[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await this.db.query<MarketRow>(
      `
      SELECT id, name, chain_name, cnpj, city, state_code,
             neighborhood, address_line, postal_code, latitude, longitude, created_at
      FROM markets
      WHERE ($1::text IS NULL
          OR name ILIKE ('%' || $1 || '%')
          OR city ILIKE ('%' || $1 || '%')
          OR chain_name ILIKE ('%' || $1 || '%'))
      ORDER BY created_at DESC
      LIMIT $2
      `,
      [search ?? null, safeLimit],
    );

    return result.rows;
  }

  async findById(id: string, client?: PoolClient): Promise<MarketRow> {
    const runner = this.getRunner(client);
    const result = await runner.query<MarketRow>(
      `
      SELECT id, name, chain_name, cnpj, city, state_code,
             neighborhood, address_line, postal_code, latitude, longitude, created_at
      FROM markets
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const market = result.rows[0];
    if (!market) {
      throw new NotFoundException(`Market ${id} was not found.`);
    }

    return market;
  }

  async create(dto: CreateMarketDto, client?: PoolClient): Promise<MarketRow> {
    const runner = this.getRunner(client);

    const result = await runner.query<MarketRow>(
      `
      INSERT INTO markets (
        name,
        chain_name,
        cnpj,
        city,
        state_code,
        neighborhood,
        address_line,
        postal_code,
        latitude,
        longitude
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric)
      RETURNING id, name, chain_name, cnpj, city, state_code,
                neighborhood, address_line, postal_code, latitude, longitude, created_at
      `,
      [
        dto.name,
        dto.chain_name ?? null,
        dto.cnpj ?? null,
        dto.city,
        dto.state_code ?? null,
        dto.neighborhood ?? null,
        dto.address_line ?? null,
        dto.postal_code ?? null,
        dto.latitude ?? null,
        dto.longitude ?? null,
      ],
    );

    return result.rows[0];
  }

  private getRunner(client?: PoolClient): DbExecutor {
    return client ?? this.db;
  }
}
