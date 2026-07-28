ALTER TABLE markets
    ADD COLUMN IF NOT EXISTS postal_code VARCHAR(12);

ALTER TABLE receipts
    ADD COLUMN IF NOT EXISTS nfce_number VARCHAR(20),
    ADD COLUMN IF NOT EXISTS nfce_series VARCHAR(20),
    ADD COLUMN IF NOT EXISTS authorization_protocol VARCHAR(40),
    ADD COLUMN IF NOT EXISTS authorization_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS total_taxes_amount NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_receipts_nfce_number_series
    ON receipts (nfce_number, nfce_series);
