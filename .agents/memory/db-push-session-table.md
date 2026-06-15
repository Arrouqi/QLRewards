---
name: db:push session-table data loss
description: Why `npm run db:push` is unsafe in this repo and what to do instead
---

Running `npm run db:push` (drizzle-kit push) prompts to DROP the `session` table
with a "data-loss" warning. The `session` table is created/managed by
connect-pg-simple (express-session store), so it is NOT in `shared/schema.ts`
and drizzle-kit treats it as an unknown table to remove.

**Rule:** Never confirm that prompt. To apply a schema change to the dev DB,
run a targeted statement instead, e.g.:
`psql "$DATABASE_URL" -c "ALTER TABLE merchants ADD COLUMN IF NOT EXISTS deleted_at timestamp;"`

**Why:** Confirming would delete active sessions (and any other non-Drizzle
table). The targeted ALTER avoids touching the session table entirely.
