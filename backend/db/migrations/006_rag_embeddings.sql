CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS canonical_product_embeddings (
    canonical_product_id UUID PRIMARY KEY
        REFERENCES canonical_products(id) ON DELETE CASCADE,
    embedding vector NOT NULL,
    embedding_model VARCHAR(120) NOT NULL,
    content_hash CHAR(64) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE receipt_items
    ADD COLUMN IF NOT EXISTS classification_source VARCHAR(30);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_receipt_item_classification_source'
    ) THEN
        ALTER TABLE receipt_items
            ADD CONSTRAINT chk_receipt_item_classification_source
            CHECK (
                classification_source IN ('manual', 'rag_confirmed')
                OR classification_source IS NULL
            );
    END IF;
END $$;
