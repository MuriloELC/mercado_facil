ALTER TABLE nfce_review_items
    ADD COLUMN IF NOT EXISTS consultation_url TEXT,
    ADD COLUMN IF NOT EXISTS consultation_opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS captcha_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS captcha_resolved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scraping_status VARCHAR(30) NOT NULL DEFAULT 'not_started',
    ADD COLUMN IF NOT EXISTS scraping_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS scraped_data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS mapped_manual_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS processing_events_json JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_nfce_captcha_status'
    ) THEN
        ALTER TABLE nfce_review_items
            ADD CONSTRAINT chk_nfce_captcha_status CHECK (
                captcha_status IN (
                    'not_started',
                    'manual_pending',
                    'resolved',
                    'expired'
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_nfce_scraping_status'
    ) THEN
        ALTER TABLE nfce_review_items
            ADD CONSTRAINT chk_nfce_scraping_status CHECK (
                scraping_status IN (
                    'not_started',
                    'pending_manual_captcha',
                    'running',
                    'completed',
                    'failed'
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nfce_scraping_status
    ON nfce_review_items (scraping_status, created_at DESC);
