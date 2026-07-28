ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_users_role'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT chk_users_role
            CHECK (role IN ('admin', 'user'));
    END IF;
END
$$;

ALTER TABLE receipts
    ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES users(id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_receipt_status'
    ) THEN
        ALTER TABLE receipts
            DROP CONSTRAINT chk_receipt_status;
    END IF;

    ALTER TABLE receipts
        ADD CONSTRAINT chk_receipt_status
        CHECK (status IN ('pending', 'in_review', 'processed', 'failed', 'duplicate'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS receipt_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    original_filename VARCHAR(255),
    mime_type VARCHAR(120),
    file_size BIGINT,
    file_hash VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_uploads_receipt
    ON receipt_uploads (receipt_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_receipts_status_created
    ON receipts (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_role
    ON users (role);
