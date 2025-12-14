-- Qatar Living Deals - Complete PostgreSQL Migration
-- This file contains the complete schema and all data
-- Use this to replicate the database exactly

BEGIN;

-- ============================================
-- DROP EXISTING TABLES (if re-creating)
-- Uncomment these lines if you need to start fresh
-- ============================================
-- DROP TABLE IF EXISTS session CASCADE;
-- DROP TABLE IF EXISTS deals CASCADE;
-- DROP TABLE IF EXISTS terms CASCADE;
-- DROP TABLE IF EXISTS sub_categories CASCADE;
-- DROP TABLE IF EXISTS categories CASCADE;
-- DROP TABLE IF EXISTS admin_users CASCADE;

-- ============================================
-- SCHEMA: ADMIN USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- ============================================
-- SCHEMA: CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- SCHEMA: SUB-CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS sub_categories (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- SCHEMA: DEALS TABLE
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
-- SCHEMA: TERMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS terms (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- ============================================
-- SCHEMA: SESSION TABLE (for express-session)
-- ============================================
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR PRIMARY KEY NOT NULL,
    sess JSON NOT NULL,
    expire TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session USING btree (expire);

-- ============================================
-- DATA: ADMIN USERS
-- ============================================
INSERT INTO admin_users (id, username, password) VALUES
('ca8a8192-68ec-430d-a537-e8170cb46cfc', 'admin', '$2b$10$qz/Pq2cDmyH7RRXX0v6uX.QFCPef32Ze6k4Ri6CSPPRycinmRUqki')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DATA: CATEGORIES
-- ============================================
INSERT INTO categories (id, name, created_at) VALUES
('95d9893a-1c8d-4f2d-9fc1-b19d6f9a1866', 'Top Category', '2025-12-09 12:45:40.903882'),
('4e09480d-5efd-4c5c-bc3f-9e0cbbc1b594', 'Second Category', '2025-12-09 12:46:07.708793'),
('aca0213c-76bf-4e3f-a46f-2fbd59825676', 'Food & Dining', '2025-12-14 11:38:06.510316'),
('c2b5f410-3539-4805-a47c-cfa28a1a99b9', 'Health & Welness', '2025-12-14 11:38:50.015994')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DATA: SUB-CATEGORIES
-- ============================================
INSERT INTO sub_categories (id, category_id, name, created_at) VALUES
('e90a05f0-2f86-4a38-b5ec-de91f18cfff0', '95d9893a-1c8d-4f2d-9fc1-b19d6f9a1866', 'best', '2025-12-09 12:45:46.684725'),
('50c20ab2-f642-47ec-9390-dd562827e713', '95d9893a-1c8d-4f2d-9fc1-b19d6f9a1866', 'Beverages', '2025-12-09 12:45:58.355663'),
('c8960949-3b61-4b18-a095-647001d59fcc', '95d9893a-1c8d-4f2d-9fc1-b19d6f9a1866', 'Food', '2025-12-09 12:46:02.696887'),
('a7cc7f0e-3593-46f8-a571-4202b60c03fc', '4e09480d-5efd-4c5c-bc3f-9e0cbbc1b594', 'Look', '2025-12-09 12:46:22.001196'),
('2fa501f5-f5dd-4e97-a419-6059f40a4546', '4e09480d-5efd-4c5c-bc3f-9e0cbbc1b594', 'The Best', '2025-12-09 12:46:29.613167'),
('f451d299-2c5a-46ea-b4a3-9ea8c18b9a0f', 'aca0213c-76bf-4e3f-a46f-2fbd59825676', 'Fine Dining', '2025-12-14 11:38:14.893569'),
('d1f16c9f-1438-4d04-af18-92b9933f0c6e', 'aca0213c-76bf-4e3f-a46f-2fbd59825676', 'Restaurants', '2025-12-14 11:38:31.244239'),
('90a3efd9-3b43-42b6-b5c6-1f64ef8c4c7d', 'aca0213c-76bf-4e3f-a46f-2fbd59825676', 'Cafes', '2025-12-14 11:38:34.262695'),
('18c8f812-baf0-4ddc-82f0-2e6b6120d86c', 'c2b5f410-3539-4805-a47c-cfa28a1a99b9', 'Hospitals', '2025-12-14 11:38:57.664719'),
('2af501f1-b929-4766-a9a2-39e6439221cf', 'c2b5f410-3539-4805-a47c-cfa28a1a99b9', 'Gyms', '2025-12-14 11:39:06.660954'),
('9ed8ebda-960a-4f10-b629-ecc9f31d07b0', 'c2b5f410-3539-4805-a47c-cfa28a1a99b9', 'Spa', '2025-12-14 11:39:20.219996')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DATA: TERMS
-- ============================================
INSERT INTO terms (id, type, text, created_at) VALUES
('fd57018c-ba60-47ef-bc01-629d9686066d', 'claim', 'deals only allowed for dine in', '2025-12-14 12:27:36.516826'),
('444c8379-0a19-4af9-8f6a-ef52b3d2a75f', 'general', 'deals only 24 hours', '2025-12-14 12:27:44.967499')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- DATA: DEALS
-- ============================================
INSERT INTO deals (id, is_ala_carte, category, sub_category, deal_type, duration, redemption, limit_per_user, original_price, is_multiple_items, discount_percentage, is_two_tranches, tranche_validity, specific_days, days, title, description, claim_rules, general_rules, other_rules, status, created_at, branches) VALUES
('52f2f056-559d-4f31-84e8-2584e1b85abb', true, 'dining', 'staycation', 'bogo', 'monthly', 'unlimited', NULL, '22232131232', false, NULL, false, NULL, false, '{}', 'asdasdasdasdasds', 'asdasdassdasdsadsasdasdasdssadsasadsadas', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Cannot be applied to already discounted items"}', 'asdadasdasad', 'approved', '2025-12-09 12:13:11.59746', '{}'),
('c97dc3be-aecd-4001-803d-ab2bbe976e6d', true, 'Food & Dining', 'Italian', 'discount', 'monthly', 'unlimited', NULL, '535', false, '50', false, NULL, false, NULL, '50% Off All Pasta Dishes', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'archived', '2025-12-14 12:27:11.637452', '{"Main Branch","City Center Branch"}'),
('a97627ed-4001-46fc-be37-8f59f5f74a74', true, 'dining', 'staycation', 'bogo', 'monthly', 'unlimited', NULL, '231', false, NULL, false, NULL, false, NULL, 'Buy 1 Get 1 Free Pizzaasdasd', 'Enjoy this amazing bogo deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.643462', '{"Main Branch","City Center Branch"}'),
('ceed7a54-120b-4473-92c7-1423a1e6ed49', true, 'Beauty & Wellness', 'Spa', 'voucher', 'monthly', 'unlimited', NULL, '368', false, NULL, false, NULL, false, NULL, 'QAR 100 Spa Voucher', 'Enjoy this amazing voucher deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.647765', '{"Main Branch","City Center Branch"}'),
('5ed2b28b-4eaf-4d95-a2b7-4e9f3750409d', true, 'Health & Fitness', 'Gym', 'discount', 'monthly', 'unlimited', NULL, '177', false, '30', false, NULL, false, NULL, '30% Off Gym Membership', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.652296', '{"Main Branch","City Center Branch"}'),
('9223a3ab-0627-4aa9-b6f5-77a1fc7c2316', true, 'Food & Dining', 'Fast Food', 'bundle', 'monthly', 'unlimited', NULL, '500', false, NULL, false, NULL, false, NULL, 'Family Bundle Meal Deal', 'Enjoy this amazing bundle deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.658112', '{"Main Branch","City Center Branch"}'),
('d83fd681-8edf-44aa-80c4-839a4316fea1', true, 'Automotive', 'Car Care', 'discount', 'monthly', 'unlimited', NULL, '116', false, '20', false, NULL, false, NULL, '20% Off Car Wash', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.662326', '{"Main Branch","City Center Branch"}'),
('20dd875c-dc55-4f40-b02c-a17c9af557ee', true, 'Food & Dining', 'Cafe', 'bogo', 'monthly', 'unlimited', NULL, '408', false, NULL, false, NULL, false, NULL, 'Buy 1 Get 1 Coffee', 'Enjoy this amazing bogo deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.666407', '{"Main Branch","City Center Branch"}'),
('4fd47ccc-40bd-47e1-8192-24cc26f554e1', true, 'Shopping', 'Mall', 'voucher', 'monthly', 'unlimited', NULL, '494', false, NULL, false, NULL, false, NULL, 'QAR 200 Shopping Voucher', 'Enjoy this amazing voucher deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.670065', '{"Main Branch","City Center Branch"}'),
('908f50b4-727f-4109-a0df-120653ba13cb', true, 'Beauty & Wellness', 'Salon', 'discount', 'monthly', 'unlimited', NULL, '140', false, '40', false, NULL, false, NULL, '40% Off Haircut', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.673773', '{"Main Branch","City Center Branch"}'),
('c5abbb48-1476-4ded-90f1-ba0e940ffea5', true, 'Entertainment', 'Kids', 'bundle', 'monthly', 'unlimited', NULL, '499', false, NULL, false, NULL, false, NULL, 'Kids Play Area Bundle', 'Enjoy this amazing bundle deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.677852', '{"Main Branch","City Center Branch"}'),
('53256dda-17e3-4f1e-a11c-ffbcadab08d4', true, 'Travel', 'Hotels', 'discount', 'monthly', 'unlimited', NULL, '135', false, '25', false, NULL, false, NULL, '25% Off Hotel Stay', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.681293', '{"Main Branch","City Center Branch"}'),
('f888f4f7-ae35-4365-977e-e965262d8d5e', true, 'Entertainment', 'Cinema', 'bogo', 'monthly', 'unlimited', NULL, '369', false, NULL, false, NULL, false, NULL, 'Buy 1 Get 1 Movie Ticket', 'Enjoy this amazing bogo deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.685024', '{"Main Branch","City Center Branch"}'),
('d8a7c4d6-2bac-4166-9927-ba269b7104f1', true, 'Shopping', 'Books', 'voucher', 'monthly', 'unlimited', NULL, '106', false, NULL, false, NULL, false, NULL, 'QAR 50 Bookstore Voucher', 'Enjoy this amazing voucher deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.690272', '{"Main Branch","City Center Branch"}'),
('089098ed-4f7f-452c-9060-876cfa33f502', true, 'Shopping', 'Electronics', 'discount', 'monthly', 'unlimited', NULL, '380', false, '35', false, NULL, false, NULL, '35% Off Electronics', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.698915', '{"Main Branch","City Center Branch"}'),
('84efb260-3426-4cfe-9e7b-f168b50f035d', true, 'Food & Dining', 'Desserts', 'bundle', 'monthly', 'unlimited', NULL, '509', false, NULL, false, NULL, false, NULL, 'Dessert Combo Bundle', 'Enjoy this amazing bundle deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.703363', '{"Main Branch","City Center Branch"}'),
('53eb3742-2bcd-49d4-9ecf-2527deba9f5e', true, 'Services', 'Laundry', 'discount', 'monthly', 'unlimited', NULL, '529', false, '15', false, NULL, false, NULL, '15% Off Dry Cleaning', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.707579', '{"Main Branch","City Center Branch"}'),
('c1a8e318-b85b-42dc-b4b9-7281da76c659', true, 'Food & Dining', 'Cafe', 'bogo', 'monthly', 'unlimited', NULL, '240', false, NULL, false, NULL, false, NULL, 'Buy 1 Get 1 Juice', 'Enjoy this amazing bogo deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.713186', '{"Main Branch","City Center Branch"}'),
('9d0891c2-496f-4708-bd2b-e18d7e18ff2a', true, 'Shopping', 'Home', 'voucher', 'monthly', 'unlimited', NULL, '68', false, NULL, false, NULL, false, NULL, 'QAR 150 Furniture Voucher', 'Enjoy this amazing voucher deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.71664', '{"Main Branch","City Center Branch"}'),
('be04df8b-726e-4004-a313-f1c2b0554646', true, 'Health & Fitness', 'Yoga', 'discount', 'monthly', 'unlimited', NULL, '356', false, '45', false, NULL, false, NULL, '45% Off Yoga Classes', 'Enjoy this amazing discount deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.720938', '{"Main Branch","City Center Branch"}'),
('3d1f4731-e42a-4f6b-ac75-f9892d373154', true, 'Food & Dining', 'Brunch', 'bundle', 'monthly', 'unlimited', NULL, '261', false, NULL, false, NULL, false, NULL, 'Weekend Brunch Bundle', 'Enjoy this amazing bundle deal! Limited time offer.', '{"Deal Valid for Dine-in, Delivery & Take away"}', '{"Deal is not applicable on public holidays & all special events"}', NULL, 'pending', '2025-12-14 12:27:11.7254', '{"Main Branch","City Center Branch"}')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- Run these after migration to verify data integrity
-- ============================================
-- SELECT 'admin_users' as table_name, COUNT(*) as row_count FROM admin_users
-- UNION ALL SELECT 'categories', COUNT(*) FROM categories
-- UNION ALL SELECT 'sub_categories', COUNT(*) FROM sub_categories
-- UNION ALL SELECT 'deals', COUNT(*) FROM deals
-- UNION ALL SELECT 'terms', COUNT(*) FROM terms;
