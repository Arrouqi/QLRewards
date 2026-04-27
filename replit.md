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
- **merchants**: Merchant onboarding applications with company info, documents, `companyType` (individual/group), and a status flow. Group merchants have specific handling for `crNumber`, `brandName`, and other details managed per-brand.
- **merchantBrands**: Stores brand-specific details for `companyType='group'` merchants, including name, address, contact, documents, and categories.
- **merchantDeals**: Deal offers per merchant, with optional `brandId`.
- **merchantNotes**: Internal, add-only comments on merchant applications.
- **adminUsers**: Admin credentials with roles (`sales`, `moderation`, `admin`) and specific permissions.
- **activityLogs**: Tracks user actions for auditing.
- **submissionLogs**: Records form submissions for debugging and monitoring.
- **systemSettings**: Key-value store for system configuration.
- **feedbacks**: Public feedback submissions (e.g., Mystery Shopper), including submission details and status management.
- **feedbackComments**: Internal comments on feedback entries.
- **redirectLogs**: Tracks deep-link landing page hits, recording visitor info, platform, outcome, and device details for analytics.

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