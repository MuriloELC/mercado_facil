-- Projeto: App inteligente de compras
-- Banco alvo: PostgreSQL 16+
-- Objetivo: schema inicial para listas, notas fiscais e base colaborativa de preços

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    city VARCHAR(120),
    state_code CHAR(2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    chain_name VARCHAR(160),
    cnpj VARCHAR(18),
    city VARCHAR(120) NOT NULL,
    state_code CHAR(2),
    neighborhood VARCHAR(120),
    address_line VARCHAR(220),
    latitude NUMERIC(9,6),
    longitude NUMERIC(9,6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS canonical_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(180) NOT NULL UNIQUE,
    canonical_name VARCHAR(180) NOT NULL,
    category VARCHAR(100),
    brand VARCHAR(100),
    package_size NUMERIC(10,3),
    package_unit VARCHAR(20),
    attributes_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_product_id UUID NOT NULL REFERENCES canonical_products(id),
    alias_text VARCHAR(220) NOT NULL,
    normalized_alias VARCHAR(220) NOT NULL,
    source VARCHAR(50) NOT NULL DEFAULT 'receipt',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (canonical_product_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_shopping_list_status
        CHECK (status IN ('active', 'archived', 'completed'))
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    raw_text VARCHAR(180) NOT NULL,
    canonical_product_id UUID REFERENCES canonical_products(id),
    quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit VARCHAR(20),
    checked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    market_id UUID REFERENCES markets(id),
    source_type VARCHAR(20) NOT NULL DEFAULT 'qrcode',
    access_key VARCHAR(60),
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    purchase_date TIMESTAMPTZ,
    total_amount NUMERIC(12,2),
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payload_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT chk_receipt_source_type
        CHECK (source_type IN ('qrcode', 'image', 'manual', 'api')),
    CONSTRAINT chk_receipt_status
        CHECK (status IN ('pending', 'processed', 'failed', 'duplicate'))
);

CREATE TABLE IF NOT EXISTS receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    raw_description VARCHAR(220) NOT NULL,
    canonical_product_id UUID REFERENCES canonical_products(id),
    quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
    unit VARCHAR(20),
    unit_price NUMERIC(12,2),
    total_price NUMERIC(12,2),
    confidence_score NUMERIC(5,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_product_id UUID NOT NULL REFERENCES canonical_products(id),
    market_id UUID NOT NULL REFERENCES markets(id),
    receipt_item_id UUID UNIQUE REFERENCES receipt_items(id) ON DELETE CASCADE,
    observed_price NUMERIC(12,2) NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS market_product_snapshots (
    market_id UUID NOT NULL REFERENCES markets(id),
    canonical_product_id UUID NOT NULL REFERENCES canonical_products(id),
    snapshot_date DATE NOT NULL,
    latest_price NUMERIC(12,2),
    average_price_7d NUMERIC(12,2),
    average_price_30d NUMERIC(12,2),
    observation_count_30d INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (market_id, canonical_product_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_markets_city_name
    ON markets (city, name);

CREATE INDEX IF NOT EXISTS idx_canonical_products_category
    ON canonical_products (category);

CREATE INDEX IF NOT EXISTS idx_product_aliases_normalized_alias
    ON product_aliases (normalized_alias);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_user
    ON shopping_lists (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipts_user
    ON receipts (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_receipts_access_key
    ON receipts (access_key)
    WHERE access_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_market_date
    ON receipts (market_id, purchase_date DESC);

CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt
    ON receipt_items (receipt_id);

CREATE INDEX IF NOT EXISTS idx_receipt_items_canonical
    ON receipt_items (canonical_product_id);

CREATE INDEX IF NOT EXISTS idx_price_observations_lookup
    ON price_observations (canonical_product_id, market_id, observed_at DESC);

CREATE OR REPLACE VIEW vw_market_latest_prices AS
SELECT DISTINCT ON (po.market_id, po.canonical_product_id)
    po.market_id,
    po.canonical_product_id,
    po.observed_price,
    po.observed_at
FROM price_observations po
ORDER BY po.market_id, po.canonical_product_id, po.observed_at DESC;

-- Query base para ranking simples por mercado:
-- Some o preço mais recente de cada produto canônico da lista e penalize faltas.
-- O cálculo final de score deve ficar na camada de aplicação.
