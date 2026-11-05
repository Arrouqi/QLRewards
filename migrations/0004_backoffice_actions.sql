-- Additive only. Apply to DEVELOPMENT first. Never run db:push.
-- Production is a separate Azure database: an authorised operator must apply
-- this manually in the rewards_external schema before deploying the new code.
-- No existing statuses/data are modified; no external requests are made.
BEGIN;
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS backoffice_merchant_id text,
  ADD COLUMN IF NOT EXISTS backoffice_created_at timestamp,
  ADD COLUMN IF NOT EXISTS last_backoffice_error text,
  ADD COLUMN IF NOT EXISTS last_backoffice_attempt_at timestamp;
ALTER TABLE merchant_deals
  ADD COLUMN IF NOT EXISTS backoffice_offer_id text,
  ADD COLUMN IF NOT EXISTS backoffice_created_at timestamp,
  ADD COLUMN IF NOT EXISTS last_backoffice_error text,
  ADD COLUMN IF NOT EXISTS last_backoffice_attempt_at timestamp;
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS backoffice_offer_id text,
  ADD COLUMN IF NOT EXISTS backoffice_created_at timestamp,
  ADD COLUMN IF NOT EXISTS last_backoffice_error text,
  ADD COLUMN IF NOT EXISTS last_backoffice_attempt_at timestamp;
COMMIT;
