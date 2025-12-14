-- Qatar Living Deals - Complete PostgreSQL Schema
-- This schema exactly replicates the current database structure
-- Generated from the production database

-- ============================================
-- ADMIN USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- SUB-CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sub_categories (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- DEALS TABLE
-- ============================================
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
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    branches TEXT[] NOT NULL DEFAULT '{}'::text[]
);

-- ============================================
-- TERMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS terms (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- SESSION TABLE (for express-session)
-- ============================================
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR PRIMARY KEY NOT NULL,
    sess JSON NOT NULL,
    expire TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Session expiry index for cleanup
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session USING btree (expire);

-- ============================================
-- CONSTRAINTS SUMMARY
-- ============================================
-- admin_users_pkey: PRIMARY KEY on admin_users(id)
-- admin_users_username_unique: UNIQUE on admin_users(username)
-- categories_pkey: PRIMARY KEY on categories(id)
-- sub_categories_pkey: PRIMARY KEY on sub_categories(id)
-- sub_categories_category_id_fkey: FOREIGN KEY sub_categories(category_id) -> categories(id)
-- deals_pkey: PRIMARY KEY on deals(id)
-- terms_pkey: PRIMARY KEY on terms(id)
-- session_pkey: PRIMARY KEY on session(sid)
