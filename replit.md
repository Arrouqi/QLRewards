# Qatar Living Deals - Merchant Portal

## Overview
This project is a merchant portal for the Qatar Living Deals platform, enabling businesses to submit and manage promotional offers. It features a public deal submission form and an administrative dashboard for deal review and approval. The application is a full-stack TypeScript project, utilizing React for the frontend and Express for the backend. The platform aims to streamline the deal submission process for merchants and provide robust management tools for administrators, contributing to the growth of promotional offerings on Qatar Living Deals.

## User Preferences
Preferred communication style: Simple, everyday language.

### Deployment & Production
- **"Production"** refers to the user's own separate environment — a different server and database, deployed via GitHub (NOT the Replit published version)
- Schema changes require manual SQL migrations on the production database
- Always list any new columns/tables added so the user can run the corresponding `ALTER TABLE` statements on their production DB
- The Replit environment is for development/testing only

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Wouter.
- **State Management**: TanStack React Query.
- **UI Components**: shadcn/ui (built on Radix UI).
- **Styling**: Tailwind CSS v4 with CSS variables.
- **Form Handling**: React Hook Form with Zod validation.
- **Animations**: Framer Motion.

### Backend Architecture
- **Runtime**: Node.js with Express.
- **Language**: TypeScript with tsx.
- **Session Management**: express-session with PostgreSQL store.
- **Authentication**: Custom session-based auth with bcryptjs.
- **API Pattern**: RESTful JSON API.

### Data Storage
- **Database**: PostgreSQL.
- **ORM**: Drizzle ORM with drizzle-zod.
- **Schema Location**: `shared/schema.ts`.
- **Migrations**: Drizzle Kit.

### Key Data Models
- **deals**: Merchant deal submissions, including category, pricing, discount, rules, and approval status.
- **merchants**: Merchant onboarding applications with company info, documents, `companyType` (individual/group), and a status flow (`pending` → `moderation` → `created` → `licensing` → `licensed` → `trained`; archivable at any point). Moving to `trained` is done via the training endpoint (not direct status change); both sales and moderation can add trainings (permission: `merchants.training`). Group merchants have specific handling for `crNumber`, `brandName`, and other details managed per-brand.
- **merchantBrands**: Stores brand-specific details for `companyType='group'` merchants, including name, address, contact, documents, and categories.
- **merchantDeals**: Deal offers per merchant, with optional `brandId`.
- **merchantNotes**: Internal, add-only comments on merchant applications.
- **merchantTrainings**: Training session logs per merchant. Fields: `trainingDate`, `trainingTime`, `trainerName`, `comment` (optional), `createdBy` (admin username). Adding a training to a `licensed` merchant automatically transitions it to `trained`. Multiple trainings can be added to `trained` merchants. Full history shown in merchant detail view.
- **adminUsers**: Admin credentials with roles (`sales`, `moderation`, `admin`) and specific permissions.
- **activityLogs**: Tracks user actions for auditing.
- **submissionLogs**: Records form submissions for debugging and monitoring.
- **systemSettings**: Key-value store for system configuration. Includes `role_permissions` key storing JSON map of `{ moderation: [...], sales: [...] }` permission arrays. Permission `merchants.training` controls training access (default: ON for both roles).
- **feedbacks**: Public feedback submissions. Two types: Mystery Shopper (full multi-section form) and Merchant Referral (Living Deals Staff Interaction form). Shared columns (`merchantName`, `merchantLocation`, `visitDate`, `shopperName`) are reused across both types; merchant referral has its own `referral_*` columns. Status: new/reviewed/archived.
- **feedbackComments**: Internal comments on feedback entries.
- **redirectLogs**: Tracks deep-link landing page hits, recording visitor info, platform, outcome, and device details for analytics.

#### Pending Production Migrations (Feedbacks feature)
Run on production DB before deploying:
```sql
-- Tables (initial Feedbacks rollout)
CREATE TABLE IF NOT EXISTS feedbacks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_type text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  shopper_name text, total_budget_qar text,
  merchant_id text, merchant_name text, merchant_location text,
  visit_date text, visit_time text,
  staff_knows_redeem text, staff_scans_qr text, reward_approved_immediately text,
  redemption_smooth text, staff_aware_of_offer text,
  product_service_quality text, merchant_comments text,
  browse_select_ease text, all_offers_redeemed_as_described text,
  offers_issue_explanation text, improvement_suggestions text,
  enjoyed_most text,
  ip_address text, user_agent text,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback_comments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id varchar NOT NULL REFERENCES feedbacks(id) ON DELETE CASCADE,
  author text NOT NULL,
  content text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Merchant Referral columns (rename of "Code Training") + shared visit_time + drop unused visit_dates
ALTER TABLE feedbacks DROP COLUMN IF EXISTS code_training_payload;
ALTER TABLE feedbacks DROP COLUMN IF EXISTS visit_dates;
ALTER TABLE feedbacks
  ADD COLUMN IF NOT EXISTS visit_time text,
  ADD COLUMN IF NOT EXISTS referral_introduced_deals text,
  ADD COLUMN IF NOT EXISTS referral_encouraged_app_download text,
  ADD COLUMN IF NOT EXISTS referral_explained_offer text,
  ADD COLUMN IF NOT EXISTS referral_provided_promo_code text,
  ADD COLUMN IF NOT EXISTS referral_subscription_smoothness text,
  ADD COLUMN IF NOT EXISTS referral_staff_knowledge text,
  ADD COLUMN IF NOT EXISTS referral_overall_satisfaction text,
  ADD COLUMN IF NOT EXISTS referral_liked_most text,
  ADD COLUMN IF NOT EXISTS referral_could_improve text;
```

#### Pending Production Migrations (Group Merchant feature)
Run on production DB before deploying:
```sql
-- Add companyType to merchants (default 'individual' for all existing rows)
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS company_type text NOT NULL DEFAULT 'individual';

-- Make individual-only fields nullable on merchants
-- (crNumber, brandName, products, businessCategories were previously required)
-- These are already nullable in Postgres if created without NOT NULL constraint.
-- If you previously added NOT NULL constraints manually, run:
-- ALTER TABLE merchants ALTER COLUMN cr_number DROP NOT NULL;
-- ALTER TABLE merchants ALTER COLUMN brand_name DROP NOT NULL;

-- Create merchantBrands table (for group company type)
CREATE TABLE IF NOT EXISTS merchant_brands (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id varchar NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  brand_name text,
  address text,
  contact_person text,
  email text,
  phone text,
  whatsapp text,
  cr_number text,
  cr_document text,
  trade_license text,
  tax_card_document text,
  establishment_card text,
  menu_price_list text,
  logo text,
  cover_image text,
  business_categories text[],
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Add brandId to merchantDeals (optional brand association for group merchants)
ALTER TABLE merchant_deals
  ADD COLUMN IF NOT EXISTS brand_id text;
```

### Project Structure
- `client/`: React frontend.
- `server/`: Express backend.
- `shared/`: Shared code, including Drizzle schema.
- `migrations/`: Database migrations.

### Build System
- **Development**: Vite for frontend, tsx for backend.
- **Production**: Custom build script using esbuild for server, Vite for client.

## External Dependencies

### Database
- **PostgreSQL**: Primary database for all application data and session storage.

### File Storage
- **Azure Blob Storage**: Used for storing uploaded merchant documents (CR, licenses, contracts, deal images).

### Elasticsearch
- **Elasticsearch**: Utilized for fetching existing merchant and offer data from production.
  - `prod_merchants` index for merchant data.
  - `prod_offers` index for live offers count.
  - Used in admin merchant lists, deal creation forms, and public feedback forms.

### Required Environment Variables
- `DATABASE_URL`
- `SESSION_SECRET`
- `AZURE_STORAGE_CONNECTION_STRING`
- `ELASTIC_URL`
- `ELASTIC_API_KEY`

### Third-Party UI Libraries
- Radix UI
- Lucide React
- date-fns
- Framer Motion
- Embla Carousel
- Vaul