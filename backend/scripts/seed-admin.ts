import * as bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { loadEnv } from '../src/config/env';

loadEnv();

const DEFAULT_DB = 'postgres://postgres:postgres@localhost:5501/lista_compras';

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DB;
  const rounds = Number(process.env.BCRYPT_ROUNDS ?? 10);

  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@local.dev';
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin123';

  const userEmail = process.env.DEFAULT_USER_EMAIL ?? 'user@local.dev';
  const userPassword = process.env.DEFAULT_USER_PASSWORD ?? 'user123';

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await upsertUser(
      client,
      {
        fullName: 'Administrator',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      },
      rounds,
    );

    await upsertUser(
      client,
      {
        fullName: 'Default User',
        email: userEmail,
        password: userPassword,
        role: 'user',
      },
      rounds,
    );

    console.log(`Default users ready: admin=${adminEmail} user=${userEmail}`);
  } finally {
    await client.end();
  }
}

async function upsertUser(
  client: Client,
  input: {
    fullName: string;
    email: string;
    password: string;
    role: 'admin' | 'user';
  },
  rounds: number,
): Promise<void> {
  const passwordHash = await bcrypt.hash(input.password, rounds);

  await client.query(
    `
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = EXCLUDED.role,
      updated_at = NOW()
    `,
    [input.fullName, input.email, passwordHash, input.role],
  );
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
