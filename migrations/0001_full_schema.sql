-- Full schema migration for Qatar Living Deals - Merchant Portal
-- Consolidated migration covering all tables and columns
-- Safe to run on any database state (uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

-- 1. Deals table
CREATE TABLE IF NOT EXISTS deals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  is_ala_carte BOOLEAN NOT NULL DEFAULT true,
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  deal_type TEXT NOT NULL,
  duration TEXT NOT NULL,
  redemption TEXT NOT NULL,
  limit_per_user TEXT,
  original_price TEXT NOT NULL,
  is_multiple_items BOOLEAN NOT NULL DEFAULT false,
  discount_percentage TEXT,
  is_two_tranches BOOLEAN NOT NULL DEFAULT false,
  tranche_validity TEXT,
  specific_days BOOLEAN NOT NULL DEFAULT false,
  days TEXT[],
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  claim_rules TEXT[] NOT NULL,
  general_rules TEXT[] NOT NULL,
  other_rules TEXT,
  branches TEXT[] NOT NULL,
  merchant_name TEXT,
  merchant_email TEXT,
  merchant_phone TEXT,
  images TEXT[],
  offer_start_date TEXT,
  offer_end_date TEXT,
  merchant_user_id TEXT,
  merchant_branch_id TEXT,
  admin_comment TEXT,
  admin_comment_history TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user'
);

-- 3. Categories table
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 4. Sub-categories table
CREATE TABLE IF NOT EXISTS sub_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id VARCHAR NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. Terms table
CREATE TABLE IF NOT EXISTS terms (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 6. Email recipients table
CREATE TABLE IF NOT EXISTS email_recipients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  recipient_type TEXT NOT NULL DEFAULT 'sales',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7. Email settings table
CREATE TABLE IF NOT EXISTS email_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'mandrill',
  api_key TEXT,
  from_email TEXT,
  from_name TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 8. Merchants table
CREATE TABLE IF NOT EXISTS merchants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  cr_number TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  address TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  products TEXT[] NOT NULL,
  business_categories TEXT[] NOT NULL,
  branches TEXT[],
  subscription_fee TEXT,
  transaction_fee TEXT,
  redemption_fee TEXT,
  cr_document TEXT,
  establishment_card TEXT,
  trade_license TEXT,
  menu_price_list TEXT,
  merchant_signature TEXT,
  merchant_signatory_name TEXT,
  company_stamp TEXT,
  merchant_sign_date TEXT,
  commencement_date TEXT,
  ql_signature TEXT,
  ql_name TEXT,
  ql_title TEXT,
  ql_sign_date TEXT,
  signed_contract_upload TEXT,
  sales_order TEXT,
  tax_card_document TEXT,
  logo TEXT,
  cover_image TEXT,
  whatsapp TEXT,
  submitted_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- V2 enhancement columns (safe to re-run)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS cover_image TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS sales_order TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS tax_card_document TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS signed_contract_upload TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS subscription_fee TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS transaction_fee TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS redemption_fee TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS submitted_by TEXT;

-- 9. Merchant deals table
CREATE TABLE IF NOT EXISTS merchant_deals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR NOT NULL REFERENCES merchants(id),
  category TEXT NOT NULL,
  sub_category TEXT NOT NULL,
  deal_type TEXT NOT NULL,
  duration TEXT NOT NULL,
  redemption TEXT NOT NULL,
  limit_per_user TEXT,
  original_price TEXT,
  is_multiple_items BOOLEAN NOT NULL DEFAULT false,
  discount_percentage TEXT,
  discounted_price TEXT,
  is_two_tranches BOOLEAN NOT NULL DEFAULT false,
  tranche_validity TEXT,
  specific_days BOOLEAN NOT NULL DEFAULT false,
  days TEXT[],
  title TEXT NOT NULL,
  description TEXT,
  claim_rules TEXT[] NOT NULL,
  general_rules TEXT[] NOT NULL,
  other_rules TEXT,
  branches TEXT[] NOT NULL,
  images TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- V2 enhancement column (safe to re-run)
ALTER TABLE merchant_deals ADD COLUMN IF NOT EXISTS discounted_price TEXT;

-- 10. Merchant notes table
CREATE TABLE IF NOT EXISTS merchant_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id VARCHAR NOT NULL REFERENCES merchants(id),
  author TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11. Session table (auto-created by connect-pg-simple, but included for completeness)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
