import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { loadEnv } from '../src/config/env';

loadEnv();

const DEFAULT_DB = 'postgres://postgres:postgres@localhost:5501/lista_compras';

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DB;
  const migrationsDir = join(__dirname, '..', 'db', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const appliedResult = await client.query<{ filename: string }>(
      `SELECT filename FROM schema_migrations`,
    );
    const applied = new Set(appliedResult.rows.map((row) => row.filename));
    const pendingFiles = files.filter((file) => !applied.has(file));

    if (pendingFiles.length === 0) {
      console.log('Database is up to date.');
      return;
    }

    for (const file of pendingFiles) {
      const path = join(migrationsDir, file);
      const sql = readFileSync(path, 'utf8').replace(/^\\uFEFF/, '');
      console.log(`Running migration: ${file}`);
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)`,
        [file],
      );
      await client.query('COMMIT');
    }

    console.log(`Applied ${pendingFiles.length} migration(s).`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
