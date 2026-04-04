-- V2 enhancements: logo, cover_image, whatsapp on merchants; discounted_price on merchant_deals
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE merchant_deals ADD COLUMN IF NOT EXISTS discounted_price TEXT;
