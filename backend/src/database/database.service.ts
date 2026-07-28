import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const DEFAULT_DB = 'postgres://postgres:postgres@localhost:5501/lista_compras';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL ?? DEFAULT_DB;
    this.pool = new Pool({ connectionString });
    this.logger.log(`Database pool initialized for ${sanitizeDatabaseUrl(connectionString)}`);
  }

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}

function sanitizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    const port = url.port ? `:${url.port}` : '';
    return `${url.protocol}//${url.hostname}${port}${url.pathname}`;
  } catch {
    return 'configured database';
  }
}
