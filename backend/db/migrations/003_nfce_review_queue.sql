CREATE TABLE IF NOT EXISTS nfce_review_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    receipt_upload_id UUID REFERENCES receipt_uploads(id) ON DELETE SET NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'received',
    extracted_type VARCHAR(20),
    extracted_value TEXT,
    extraction_method VARCHAR(20),
    extraction_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    raw_extraction_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    selected_by UUID REFERENCES users(id),
    selected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_nfce_review_status CHECK (
        status IN (
            'received',
            'extracting_reference',
            'reference_extracted',
            'pending_review',
            'in_review',
            'extraction_failed'
        )
    ),
    CONSTRAINT chk_nfce_review_type CHECK (
        extracted_type IN ('qrcode', 'url', 'access_key') OR extracted_type IS NULL
    ),
    CONSTRAINT chk_nfce_review_method CHECK (
        extraction_method IN ('qr', 'ocr', 'heuristic', 'manual') OR extraction_method IS NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_nfce_review_status_created
    ON nfce_review_items (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nfce_review_user
    ON nfce_review_items (user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uidx_nfce_review_receipt
    ON nfce_review_items (receipt_id);
