-- Qatar Living Deals - Production Data Seed for Azure PostgreSQL
-- Run this SQL in your Production Database (Azure)
-- Schema: rewards_external

-- Set the schema
SET search_path TO rewards_external;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sub_categories (
    id VARCHAR(36) PRIMARY KEY,
    category_id VARCHAR(36) NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS terms (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(36) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR(36) PRIMARY KEY,
    category_id VARCHAR(36) REFERENCES categories(id),
    sub_category_id VARCHAR(36) REFERENCES sub_categories(id),
    brand_name VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    discount_type VARCHAR(50),
    discount_amount DECIMAL(10,2),
    discount_percentage INTEGER,
    start_date DATE,
    end_date DATE,
    claim_rules TEXT[],
    general_rules TEXT[],
    locations TEXT[],
    images TEXT[],
    status VARCHAR(50) DEFAULT 'pending',
    merchant_email VARCHAR(255),
    merchant_phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);

-- Categories
INSERT INTO categories (id, name, created_at) VALUES
('94014bd7-e22b-4863-bee1-5afb8a0a7d87', 'Food & Dining', '2025-12-23 10:14:19.882355'),
('12333fca-6aed-48ed-a07a-414747865ba7', 'Hotel & Resorts', '2025-12-23 10:14:19.882355'),
('9a8c0aed-a929-4abf-9331-965fcd1bd706', 'Travel & Leisure', '2025-12-23 10:14:19.882355'),
('554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Health & Wellness', '2025-12-23 10:14:19.882355'),
('d7fe10d6-c875-4799-858b-7a1cba50de99', 'Shopping & Retail', '2025-12-23 10:14:19.882355'),
('a50b8753-63c9-4d78-98fc-253e58d93b88', 'Entertainment & Activities', '2025-12-23 10:14:19.882355'),
('ecf80dcc-0ddb-4960-890a-8aa4fd0d604a', 'Education & Learning', '2025-12-23 10:14:19.882355'),
('39a14e30-a462-4354-807f-6ed17afdb52d', 'Automotive', '2025-12-23 10:14:19.882355'),
('4b7507f0-0257-4bc8-bc30-ceb91de1968b', 'Home Services', '2025-12-23 10:14:19.882355'),
('0d8c522c-c95d-40cb-9c8d-457b543e4cd9', 'Financial & Professional Services', '2025-12-23 10:14:19.882355'),
('0af87c5f-08b6-41c5-b92b-3b4333152a2a', 'Collectibles', '2025-12-23 10:14:19.882355')
ON CONFLICT (id) DO NOTHING;

-- Sub-Categories
INSERT INTO sub_categories (id, category_id, name, created_at) VALUES
-- Food & Dining
('89214111-2170-4feb-bf91-f0bd476e7165', '94014bd7-e22b-4863-bee1-5afb8a0a7d87', 'Fine Dining', '2025-12-23 10:14:54.794811'),
('15260452-ef28-41fc-814f-3f587d0ead84', '94014bd7-e22b-4863-bee1-5afb8a0a7d87', 'Restaurants', '2025-12-23 10:14:54.794811'),
('acc642ce-9f5c-48f6-af71-b23660b1ad77', '94014bd7-e22b-4863-bee1-5afb8a0a7d87', 'Cafes', '2025-12-23 10:14:54.794811'),
('61c8e433-10b1-4dfb-9100-849a95263227', '94014bd7-e22b-4863-bee1-5afb8a0a7d87', 'Fast Food', '2025-12-23 10:14:54.794811'),
('c5eee6a2-7605-466e-9993-e803169c4861', '94014bd7-e22b-4863-bee1-5afb8a0a7d87', 'Delivery Services', '2025-12-23 10:14:54.794811'),
('54f3ff52-3c4f-47d1-8a09-5d10862b6c95', '94014bd7-e22b-4863-bee1-5afb8a0a7d87', 'Casual Dining', '2025-12-23 10:14:54.794811'),
-- Hotel & Resorts
('55f23dbc-1702-43b5-8cd5-73a0b5659d44', '12333fca-6aed-48ed-a07a-414747865ba7', 'Spa & Wellness', '2025-12-23 10:14:54.794811'),
('d783d290-b612-4973-b884-a5bc0f83612e', '12333fca-6aed-48ed-a07a-414747865ba7', 'Pool & Beach Access', '2025-12-23 10:14:54.794811'),
('26515c51-8d11-4eef-9e06-ab71adda6a1e', '12333fca-6aed-48ed-a07a-414747865ba7', 'Dining & Restaurants', '2025-12-23 10:14:54.794811'),
('e5088f28-62ab-4a67-8bc5-68cac5dbda12', '12333fca-6aed-48ed-a07a-414747865ba7', 'Stays & Getaways', '2025-12-23 10:14:54.794811'),
('89d186e4-5be5-4de6-b9c7-ad6b47b9175d', '12333fca-6aed-48ed-a07a-414747865ba7', 'Luxury & VIP Packages', '2025-12-23 10:14:54.794811'),
('e9fe1775-728d-40a4-95d1-bfe1e27117ef', '12333fca-6aed-48ed-a07a-414747865ba7', 'Kids & Family Offers', '2025-12-23 10:14:54.794811'),
('d79c9839-404a-4255-9384-058c40c5a4b5', '12333fca-6aed-48ed-a07a-414747865ba7', 'Brunch & Buffets', '2025-12-23 10:14:54.794811'),
-- Travel & Leisure
('0432e31e-0d90-4723-8a33-9a07b118c248', '9a8c0aed-a929-4abf-9331-965fcd1bd706', 'Tours', '2025-12-23 10:14:54.794811'),
('f617ab3d-0753-4145-b3fb-d2be40b02b25', '9a8c0aed-a929-4abf-9331-965fcd1bd706', 'Airlines', '2025-12-23 10:14:54.794811'),
('83c1d1ac-bbce-42a8-a9fc-b3122a5a6d46', '9a8c0aed-a929-4abf-9331-965fcd1bd706', 'Car Rentals', '2025-12-23 10:14:54.794811'),
('2e6c6259-4e2e-478a-a81c-f0852507056a', '9a8c0aed-a929-4abf-9331-965fcd1bd706', 'Travel Packages', '2025-12-23 10:14:54.794811'),
('c906a1c7-5143-405b-8f13-d68f3df50fcd', '9a8c0aed-a929-4abf-9331-965fcd1bd706', 'Group Bookings', '2025-12-23 10:14:54.794811'),
-- Health & Wellness
('c6d0e356-d5c2-44e7-bb98-ceb30a76c220', '554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Wellness Centers', '2025-12-23 10:15:16.112914'),
('00a4948e-7543-4709-91cf-586a2f28e29d', '554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Hospitals', '2025-12-23 10:15:16.112914'),
('0cf8b689-9c04-4067-a8b7-68e49352797c', '554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Pharmacies', '2025-12-23 10:15:16.112914'),
('946d0931-6a94-44f9-86da-939cf4df8a1a', '554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Gyms', '2025-12-23 10:15:16.112914'),
('88ca4e18-9f49-47c0-90e1-0ee27b518898', '554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Spas', '2025-12-23 10:15:16.112914'),
('94579e10-789c-4d56-835a-feff36afc8fb', '554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Beauty Salons', '2025-12-23 10:15:16.112914'),
('f429bca4-2afa-4177-bf4a-cb3422b41d60', '554c0325-4d67-4ce5-98d3-6957d26a2aa6', 'Medical Clinics', '2025-12-23 10:15:16.112914'),
-- Shopping & Retail
('7b38914f-8657-456f-91ec-bf6417c4588f', 'd7fe10d6-c875-4799-858b-7a1cba50de99', 'Accessories', '2025-12-23 10:15:16.112914'),
('f169f5d3-ff2c-466d-8f4c-0d07dcd35998', 'd7fe10d6-c875-4799-858b-7a1cba50de99', 'Electronics', '2025-12-23 10:15:16.112914'),
('eafab125-da57-4cac-8fe0-b0502cf6bb67', 'd7fe10d6-c875-4799-858b-7a1cba50de99', 'Fashion', '2025-12-23 10:15:16.112914'),
('8ad3fd07-8d90-4e61-95c8-a89d013f071b', 'd7fe10d6-c875-4799-858b-7a1cba50de99', 'Food & Beverage', '2025-12-23 10:15:16.112914'),
('15299a2f-8ac9-4595-a900-f1137fb4826e', 'd7fe10d6-c875-4799-858b-7a1cba50de99', 'Beauty Products', '2025-12-23 10:15:16.112914'),
('83f262af-9c83-4a2c-a2a6-53cd67c31b9c', 'd7fe10d6-c875-4799-858b-7a1cba50de99', 'Supermarkets', '2025-12-23 10:15:16.112914'),
('991ebe12-54b3-4288-b5cc-bd7fc67c8882', 'd7fe10d6-c875-4799-858b-7a1cba50de99', 'Home Goods', '2025-12-23 10:15:16.112914'),
-- Entertainment & Activities
('62649b90-7b69-48f8-b29a-b4fc284b8330', 'a50b8753-63c9-4d78-98fc-253e58d93b88', 'Cinema', '2025-12-23 10:15:16.112914'),
('e2aa615a-9443-4ad5-91a3-3d503c6e5205', 'a50b8753-63c9-4d78-98fc-253e58d93b88', 'Amusement Parks', '2025-12-23 10:15:16.112914'),
('51debe90-7faa-41c6-b9ab-f896adeef03b', 'a50b8753-63c9-4d78-98fc-253e58d93b88', 'Gaming Centers', '2025-12-23 10:15:16.112914'),
('dcbd79bd-d64b-4a3c-b4c1-718a5040b997', 'a50b8753-63c9-4d78-98fc-253e58d93b88', 'Kids Activities', '2025-12-23 10:15:16.112914'),
('e9240f04-f3f1-4c28-a7c9-63375ea3e409', 'a50b8753-63c9-4d78-98fc-253e58d93b88', 'Theme Parks', '2025-12-23 10:15:16.112914'),
-- Education & Learning
('4b13a74a-e3cf-4241-a14e-84b29ec10821', 'ecf80dcc-0ddb-4960-890a-8aa4fd0d604a', 'Training Centers', '2025-12-23 10:15:39.610693'),
('482c4688-35b2-4fc0-83a7-cb9a77c29136', 'ecf80dcc-0ddb-4960-890a-8aa4fd0d604a', 'Nurseries', '2025-12-23 10:15:39.610693'),
('dfb74cfc-c31f-451d-b0ed-789c44eaa2f2', 'ecf80dcc-0ddb-4960-890a-8aa4fd0d604a', 'Kids Educational Activities', '2025-12-23 10:15:39.610693'),
('6dac7d65-2e6a-4c31-a84d-098948727b85', 'ecf80dcc-0ddb-4960-890a-8aa4fd0d604a', 'Tutoring', '2025-12-23 10:15:39.610693'),
('4c0e11f8-ea9c-4753-851a-6d5c10973440', 'ecf80dcc-0ddb-4960-890a-8aa4fd0d604a', 'Online Courses', '2025-12-23 10:15:39.610693'),
-- Automotive
('65764b48-d5db-452b-b4a2-9dda438aa391', '39a14e30-a462-4354-807f-6ed17afdb52d', 'Rentals', '2025-12-23 10:15:39.610693'),
('a56cc210-d110-49ab-b1b3-987fb48a9f92', '39a14e30-a462-4354-807f-6ed17afdb52d', 'Dealerships', '2025-12-23 10:15:39.610693'),
('e51ccccc-8dd2-48e5-8a3f-b972ffd32223', '39a14e30-a462-4354-807f-6ed17afdb52d', 'Car Servicing', '2025-12-23 10:15:39.610693'),
('bbb7c94c-883d-4a71-94b6-e248e0473d58', '39a14e30-a462-4354-807f-6ed17afdb52d', 'Detailing', '2025-12-23 10:15:39.610693'),
-- Home Services
('8f57cef2-aec4-4f5b-b127-848e28fc240a', '4b7507f0-0257-4bc8-bc30-ceb91de1968b', 'Cleaning', '2025-12-23 10:15:39.610693'),
('1ba1eab1-70fd-4f39-a046-fa16d1d8bb34', '4b7507f0-0257-4bc8-bc30-ceb91de1968b', 'Landscaping', '2025-12-23 10:15:39.610693'),
('b12148a2-a2a1-40ce-a381-347ac08265e4', '4b7507f0-0257-4bc8-bc30-ceb91de1968b', 'Pest Control', '2025-12-23 10:15:39.610693'),
('ccc31262-d495-4a14-ab66-3d684e0a8d43', '4b7507f0-0257-4bc8-bc30-ceb91de1968b', 'Laundry', '2025-12-23 10:15:39.610693'),
('02494b64-9099-4a52-b037-13e3e5d1a1e4', '4b7507f0-0257-4bc8-bc30-ceb91de1968b', 'Maintenance', '2025-12-23 10:15:39.610693'),
-- Financial & Professional Services
('181a70f7-6b80-4383-b7d4-1a8ee0523551', '0d8c522c-c95d-40cb-9c8d-457b543e4cd9', 'Consulting', '2025-12-23 10:15:39.610693'),
('983072cb-a0bc-478f-8378-48119df9cd2a', '0d8c522c-c95d-40cb-9c8d-457b543e4cd9', 'Accounting', '2025-12-23 10:15:39.610693'),
('873b4eb9-4b09-41e8-a120-db5786c7562b', '0d8c522c-c95d-40cb-9c8d-457b543e4cd9', 'Legal', '2025-12-23 10:15:39.610693'),
('11109dc6-03c1-489c-a682-0a2d3b440a3d', '0d8c522c-c95d-40cb-9c8d-457b543e4cd9', 'Banking', '2025-12-23 10:15:39.610693'),
('387ccef6-040f-4917-80bb-a9bf5224b1e4', '0d8c522c-c95d-40cb-9c8d-457b543e4cd9', 'Insurance', '2025-12-23 10:15:39.610693'),
-- Collectibles
('0d292ae8-f43c-4f77-9207-3e91aeb76d15', '0af87c5f-08b6-41c5-b92b-3b4333152a2a', 'Pokemon Cards', '2025-12-23 10:15:39.610693')
ON CONFLICT (id) DO NOTHING;

-- Terms
INSERT INTO terms (id, type, text, created_at) VALUES
('fd57018c-ba60-47ef-bc01-629d9686066d', 'claim', 'Offer Valid only for Dine-in (Not valid on Delivery / Take away).', '2025-12-14 12:27:36.516826'),
('250ac1c0-7d8f-41d4-bcb6-435348385bc6', 'claim', 'Offer Valid only for Delivery / Take away.', '2025-12-14 15:02:04.339775'),
('e72d8303-4801-4496-9ddf-ed230c0712e7', 'claim', 'Offer Valid for Dine-in, Delivery & Take away.', '2025-12-16 11:58:09.225837'),
('6a1bd830-4db4-44ef-b9c9-4197564ea68c', 'claim', 'Multiple offers cannot be combined in the same transaction.', '2025-12-16 11:58:16.046725'),
('2ec2f6c8-0290-4aff-a0fc-af42599fab2c', 'claim', 'One voucher per person per visit.', '2025-12-16 11:58:24.700575'),
('b825525e-0fa2-4b6d-a4ed-842850b2d3a6', 'claim', 'One voucher per table/group/bill.', '2025-12-16 11:58:29.585703'),
('444c8379-0a19-4af9-8f6a-ef52b3d2a75f', 'general', 'Offer is not applicable on public holidays & all special events.', '2025-12-14 12:27:44.967499'),
('21a9ad5b-d807-4717-a09f-74108d23697d', 'general', 'Advance booking or reservation requirement.', '2025-12-14 15:02:10.740387'),
('b6a4b0e0-98cb-4acf-8566-0dd943639399', 'general', 'Cannot be applied to already discounted items.', '2025-12-16 11:58:47.33279'),
('d2dda9ce-d4c3-47f2-8d8a-001f00326ebb', 'general', 'Cannot be combined with employee discounts.', '2025-12-16 11:58:51.169947')
ON CONFLICT (id) DO NOTHING;

-- Admin Users (password is 'admin123' for admin user, 'Francis123' for Francis)
INSERT INTO admin_users (id, username, password, role) VALUES
('ca8a8192-68ec-430d-a537-e8170cb46cfc', 'admin', '$2b$10$qz/Pq2cDmyH7RRXX0v6uX.QFCPef32Ze6k4Ri6CSPPRycinmRUqki', 'admin'),
('c79a04e9-5baf-453a-825a-d03469f19eaf', 'Francis', '$2b$10$OaOTqiX8gpmhM8jlFo4VfOTHsfilaSXTdICIbhkx3M0ukhchnDevq', 'user')
ON CONFLICT (id) DO NOTHING;
