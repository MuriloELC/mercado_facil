const DEFAULT_TEST_DATABASE_URL =
  'postgres://postgres:postgres@localhost:5502/lista_compras_test';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;
process.env.JWT_SECRET ??= 'test-only-jwt-secret-never-use-in-production';
process.env.DEFAULT_ADMIN_EMAIL ??= 'admin@local.dev';
process.env.DEFAULT_ADMIN_PASSWORD ??= 'admin123';
process.env.DEFAULT_USER_EMAIL ??= 'user@local.dev';
process.env.DEFAULT_USER_PASSWORD ??= 'user123';
process.env.UPLOAD_DIR ??= 'uploads/test-receipts';

const parsed = new URL(process.env.DATABASE_URL);
const databaseName = parsed.pathname.replace(/^\//, '');

if (!databaseName.endsWith('_test')) {
  throw new Error(
    `Refusing to run destructive E2E tests against database "${databaseName}".`,
  );
}
