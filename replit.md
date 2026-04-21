# Qatar Living Deals - Merchant Portal

## Overview

This is a merchant portal for the Qatar Living Deals platform where businesses can submit and manage promotional offers. The application features a public-facing deal submission form and an admin dashboard for reviewing and approving deals. Built as a full-stack TypeScript application with React frontend and Express backend.

## User Preferences

Preferred communication style: Simple, everyday language.

### Deployment & Production
- **"Production"** refers to the user's own separate environment — a different server and database, deployed via GitHub (NOT the Replit published version)
- Schema changes require manual SQL migrations on the production database
- Always list any new columns/tables added so the user can run the corresponding `ALTER TABLE` statements on their production DB
- The Replit environment is for development/testing only

#### Pending Production Migrations (Group Company feature)
Run these on the production DB before deploying the Group Company feature:
```sql
-- 1. Add companyType to merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS company_type text NOT NULL DEFAULT 'individual';

-- 2. Make individual-only fields nullable
ALTER TABLE merchants ALTER COLUMN cr_number DROP NOT NULL;
ALTER TABLE merchants ALTER COLUMN brand_name DROP NOT NULL;
ALTER TABLE merchants ALTER COLUMN products DROP NOT NULL;
ALTER TABLE merchants ALTER COLUMN business_categories DROP NOT NULL;

-- 3. Add brandId to merchant_deals (nullable)
ALTER TABLE merchant_deals ADD COLUMN IF NOT EXISTS brand_id text;

-- 4. Create merchant_brands table
-- (If merchant_brands already exists without ON DELETE CASCADE, run:
--   ALTER TABLE merchant_brands DROP CONSTRAINT IF EXISTS merchant_brands_merchant_id_fkey;
--   ALTER TABLE merchant_brands ADD CONSTRAINT merchant_brands_merchant_id_fkey
--     FOREIGN KEY (merchant_id) REFERENCES merchants(id) ON DELETE CASCADE; )
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
  establishment_card text,
  trade_license text,
  tax_card_document text,
  menu_price_list text,
  logo text,
  cover_image text,
  business_categories text[],
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_merchant_brands_merchant_id ON merchant_brands(merchant_id);
```

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter for client-side routing (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation
- **Animations**: Framer Motion for page transitions and micro-interactions

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript with tsx for development execution
- **Session Management**: express-session with PostgreSQL session store (connect-pg-simple)
- **Authentication**: Custom session-based auth with bcryptjs for password hashing
- **API Pattern**: RESTful JSON API under `/api/*` routes

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all database table definitions
- **Migrations**: Drizzle Kit for schema management (`npm run db:push`)

### Key Data Models
- **deals**: Stores merchant deal submissions with fields for category, pricing, discount info, rules, and approval status
- **merchants**: Stores merchant onboarding applications with company info, documents (CR, trade license, tax card, logo, cover image, etc.), WhatsApp number, sales order PDF (Azure URL), signed contract, `submittedBy` (admin who forwarded to moderation), `offersCreated` (integer counter), `companyType` ('individual' | 'group', default 'individual'), and status flow (pending ↔ moderation → created → licensing → licensed; any non-archived → archived; archived → pending/moderation). Admin role can permanently delete archived merchants. For `companyType='group'` merchants: `crNumber`, `brandName`, per-merchant CR/trade/tax/menu/logo/cover documents, `products`, and `businessCategories` are all empty/null at the merchant level — those values live per-brand in `merchantBrands` instead.
- **merchantBrands**: Per-brand records for `companyType='group'` merchants (1-50 per merchant). Holds brandName, address, contactPerson, email, phone, whatsapp, crNumber, document URLs (crDocument, establishmentCard, tradeLicense, taxCardDocument, menuPriceList, logo, coverImage), businessCategories array, and displayOrder. All fields nullable. Branches (JSON) and merchantDeals can each reference a brand via `brandId` (the brand's index/UUID).
- **merchantDeals**: Stores deal offers per merchant with category, pricing, discount percentage OR discounted price, rules, images, and availability days. Optional `brandId` for group merchants.
- **merchantNotes**: Internal notes/comments on merchant applications (author, content, timestamp); thread-style, add-only
- **adminUsers**: Stores admin credentials for the dashboard (managed via Settings → Users tab, admin-only). Roles: `sales` (forward pending→moderation only, edit pending merchants only), `moderation` (manage moderation+ merchants, no access to With Sales), `admin` (full access including settings, archive management, permanent delete, activity logs)
- **activityLogs**: Tracks user actions (status changes, edits) with username, action, merchantId, merchantName, details, timestamp. Admin-only viewing & clearing via Settings → Activity tab.
- **submissionLogs**: Records form submissions (merchant onboarding & deal creation) with status, request body (base64 files sanitized), fields received, file info, errors, IP, user agent, processing time. Toggled on/off via system settings. Admin-only viewing & clearing via Settings → Submission Logs tab.
- **systemSettings**: Key-value store for system configuration (e.g., `submission_logging_enabled`). Admin-only write access.
- **session**: PostgreSQL session store table (auto-created)

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/ui/  # shadcn/ui components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and API client
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database access layer
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   └── schema.ts     # Drizzle schema definitions
└── migrations/       # Database migrations
```

### Build System
- Development: Vite dev server with HMR for frontend, tsx for backend
- Production: Custom build script using esbuild for server bundling, Vite for client
- Output: `dist/` directory with `index.cjs` (server) and `public/` (static assets)

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- Session store uses the same PostgreSQL database

### File Storage
- **Azure Blob Storage**: Used for document uploads (CR documents, trade licenses, signed contracts, sales order PDFs, deal images)
- Connection via `AZURE_STORAGE_CONNECTION_STRING` environment variable
- Container: `deals-clients`
- Upload pattern: client FileReader → base64 → POST to server → upload to Azure → store URL in DB

### Elasticsearch (Production Merchants & Offers)
- **Elasticsearch**: Used to fetch existing merchant and offer data from production
- Endpoint: `ELASTIC_URL` env var, authenticated via `ELASTIC_API_KEY` (ApiKey auth)
- Index: `prod_merchants` — contains 103 merchants with fields: agencyName, agencyEmail, agencyId, category, contactMobile, branches, website, status, etc.
- Index: `prod_offers` — contains live offers on the platform; used for total live offers count on Overview page
- API routes: `GET /api/es/merchants?search=&size=&from=` (authenticated), `GET /api/es/offers/count` (authenticated)
- Used in: Admin "Merchants" list page (`/admin/existing-merchants`), Deal creation form merchant dropdown (`/create-deal`), Overview page statistics

### Required Environment Variables
- `DATABASE_URL`: PostgreSQL connection string (required)
- `SESSION_SECRET`: Secret for session encryption (optional, has default)
- `AZURE_STORAGE_CONNECTION_STRING`: Azure Blob Storage connection (required for file uploads)
- `ELASTIC_URL`: Elasticsearch endpoint URL for production merchants (required for merchant list/deal creation dropdown)
- `ELASTIC_API_KEY`: Elasticsearch API key (base64-encoded, required for merchant list/deal creation dropdown)

### Third-Party UI Libraries
- Radix UI primitives for accessible components
- Lucide React for icons
- date-fns for date formatting
- Framer Motion for animations
- Embla Carousel for carousel components
- Vaul for drawer component

### Development Tools
- Replit-specific Vite plugins for development experience (cartographer, dev-banner, runtime-error-modal)
- Custom meta images plugin for OpenGraph tags