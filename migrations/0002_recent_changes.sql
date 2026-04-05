-- Recent changes migration (last 2-3 tasks)
-- Covers: V2 enhancements + Submitted By + Merchant Notes
-- Safe to re-run (uses IF NOT EXISTS)

-- V2: Add logo, cover image, whatsapp to merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- V2: Add discounted_price to merchant_deals
ALTER TABLE merchant_deals ADD COLUMN IF NOT EXISTS discounted_price TEXT;

-- Task 3: Add submitted_by to merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS submitted_by TEXT;

-- Task 3: Create merchant_notes table
CREATE TABLE IF NOT EXISTS merchant_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR NOT NULL REFERENCES merchants(id),
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
