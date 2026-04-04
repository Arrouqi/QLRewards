ALTER TABLE merchants ADD COLUMN IF NOT EXISTS submitted_by TEXT;

CREATE TABLE IF NOT EXISTS merchant_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR NOT NULL REFERENCES merchants(id),
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
