import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

describe('Admin API (integration)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let token: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    db = moduleRef.get(DatabaseService);
    await ensureTestDatabaseAvailable(db);

    await applyMigrations(db);
    await ensureAdmin(db);
    await ensureUser(db);

    token = await login(app);
    userToken = await loginUser(app);
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM nfce_review_items`);
    await db.query(`DELETE FROM shopping_list_items`);
    await db.query(`DELETE FROM shopping_lists`);
    await db.query(`DELETE FROM price_observations`);
    await db.query(`DELETE FROM receipt_items`);
    await db.query(`DELETE FROM receipt_uploads`);
    await db.query(`DELETE FROM receipts`);
    await db.query(`DELETE FROM product_aliases`);
    await db.query(`DELETE FROM canonical_products`);
    await db.query(`DELETE FROM markets`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('intake with image and no QR creates pending receipt', async () => {
    const res = await request(app.getHttpServer())
      .post('/admin/receipts/intake')
      .set('Authorization', `Bearer ${token}`)
      .field('source_type', 'image')
      .attach('image', Buffer.from('fake-image-bytes'), 'nota.jpg')
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('pending');
    expect(Array.isArray(res.body.uploads)).toBe(true);
    expect(res.body.uploads.length).toBe(1);
  });

  it('intake with existing access_key marks duplicate', async () => {
    const qr =
      'https://nfce.example?q=35260312345678000123650010000012341234567890';

    const first = await request(app.getHttpServer())
      .post('/admin/receipts/intake')
      .set('Authorization', `Bearer ${token}`)
      .send({ source_type: 'qrcode', qr_text: qr })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/admin/receipts/intake')
      .set('Authorization', `Bearer ${token}`)
      .send({ source_type: 'qrcode', qr_text: qr })
      .expect(201);

    expect(first.body.id).toBe(second.body.id);
    expect(second.body.status).toBe('duplicate');
  });

  it('manual-process persists a confirmed RAG link and price observation', async () => {
    const intake = await request(app.getHttpServer())
      .post('/admin/receipts/intake')
      .set('Authorization', `Bearer ${token}`)
      .send({ source_type: 'manual', qr_text: 'manual-note' })
      .expect(201);

    const receiptId = intake.body.id;

    const product = await request(app.getHttpServer())
      .post('/admin/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ canonical_name: 'Arroz Tipo 1 1kg', category: 'Mercearia' })
      .expect(201);

    const processed = await request(app.getHttpServer())
      .put(`/admin/receipts/${receiptId}/manual-process`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        market: {
          name: 'Mercado Central',
          city: 'Manaus',
        },
        purchase_date: new Date().toISOString(),
        total_amount: 23.5,
        items: [
          {
            raw_description: 'ARROZ TIPO 1 1KG',
            quantity: 1,
            unit: 'UN',
            unit_price: 12.4,
            canonical_product_id: product.body.id,
            classification_source: 'rag_confirmed',
            classification_confidence: 0.87,
            alias_text: 'ARROZ TIPO 1 1KG',
          },
        ],
      })
      .expect(200);

    expect(processed.body.status).toBe('processed');
    expect(processed.body.items.length).toBe(1);

    expect(processed.body.items[0].classification_source).toBe('rag_confirmed');
    expect(Number(processed.body.items[0].confidence_score)).toBeCloseTo(0.87);

    const alias = await db.query<{ source: string }>(
      `SELECT source FROM product_aliases WHERE canonical_product_id = $1`,
      [product.body.id],
    );
    expect(alias.rows[0].source).toBe('rag_confirmed');

    const po = await db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM price_observations`,
    );
    expect(po.rows[0].count).toBe('1');
  });

  it('mark-failed updates receipt status without deleting receipt', async () => {
    const intake = await request(app.getHttpServer())
      .post('/admin/receipts/intake')
      .set('Authorization', `Bearer ${token}`)
      .send({ source_type: 'manual', qr_text: 'to-fail' })
      .expect(201);

    const failed = await request(app.getHttpServer())
      .post(`/admin/receipts/${intake.body.id}/mark-failed`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(failed.body.status).toBe('failed');

    const receipt = await db.query<{ id: string; status: string }>(
      `SELECT id, status FROM receipts WHERE id = $1`,
      [intake.body.id],
    );

    expect(receipt.rows[0].id).toBe(intake.body.id);
    expect(receipt.rows[0].status).toBe('failed');
  });

  it('user can create a shopping list with items', async () => {
    const list = await request(app.getHttpServer())
      .post('/user/lists')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Compra da semana' })
      .expect(201);

    expect(list.body.id).toBeDefined();
    expect(list.body.name).toBe('Compra da semana');
    expect(list.body.status).toBe('active');

    const item = await request(app.getHttpServer())
      .post(`/user/lists/${list.body.id}/items`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ raw_text: 'Arroz tipo 1', quantity: 2, unit: 'kg' })
      .expect(201);

    expect(item.body.id).toBeDefined();
    expect(item.body.raw_text).toBe('Arroz tipo 1');
    expect(item.body.quantity).toBe('2.000');
    expect(item.body.unit).toBe('kg');
    expect(item.body.checked).toBe(false);
  });

  it('user NFC-e intake accepts qr_text without image upload', async () => {
    const qr =
      'https://nfce.example?q=35260312345678000123650010000022341234567891';

    const intake = await request(app.getHttpServer())
      .post('/user/nfce/intake')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ qr_text: qr })
      .expect(201);

    expect(intake.body.id).toBeDefined();
    expect(intake.body.receipt_id).toBeDefined();
    expect(intake.body.receipt_upload_id).toBeNull();
    expect(intake.body.status).toBe('reference_extracted');
    expect(intake.body.extracted_type).toBe('url');
    expect(intake.body.extracted_value).toBe(qr);
    expect(intake.body.extraction_method).toBe('qr');
  });

  it('user NFC-e intake returns existing queue item for duplicate qr_text', async () => {
    const qr =
      'https://nfce.example?q=35260312345678000123650010000032341234567892';

    const first = await request(app.getHttpServer())
      .post('/user/nfce/intake')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ qr_text: qr })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post('/user/nfce/intake')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ qr_text: qr })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.receipt_id).toBe(first.body.receipt_id);
  });

  it('user NFC-e intake requires image or qr_text', async () => {
    const response = await request(app.getHttpServer())
      .post('/user/nfce/intake')
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Image file or qr_text is required.');
  });
});

async function ensureTestDatabaseAvailable(db: DatabaseService): Promise<void> {
  try {
    await db.query('SELECT 1');
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      'Test database is unavailable at localhost:5502/lista_compras_test. ' +
        'Start it with "npm run db:test:up" before running the E2E suite.' +
        detail,
    );
  }
}

async function applyMigrations(db: DatabaseService): Promise<void> {
  const migrationsDir = join(__dirname, '..', 'db', 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    await db.query(sql);
  }
}

async function ensureAdmin(db: DatabaseService): Promise<void> {
  const email = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@local.dev';
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin123';
  const hash = await bcrypt.hash(password, 10);

  await db.query(
    `
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ('Admin', $1, $2, 'admin')
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'admin',
      updated_at = NOW()
    `,
    [email, hash],
  );
}

async function ensureUser(db: DatabaseService): Promise<void> {
  const email = 'user@local.dev';
  const password = 'user123';
  const hash = await bcrypt.hash(password, 10);

  await db.query(
    `
    INSERT INTO users (full_name, email, password_hash, role)
    VALUES ('User', $1, $2, 'user')
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'user',
      updated_at = NOW()
    `,
    [email, hash],
  );
}

async function login(app: INestApplication): Promise<string> {
  const email = process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@local.dev';
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? 'admin123';

  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(201);

  return response.body.access_token;
}

async function loginUser(app: INestApplication): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email: 'user@local.dev', password: 'user123' })
    .expect(201);

  return response.body.access_token;
}
