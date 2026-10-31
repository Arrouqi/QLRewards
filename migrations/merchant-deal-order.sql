-- Run only against the external production application's schema.
-- GitHub Actions wraps this statement and verification in one transaction.
-- No records are deleted; IDs, statuses and backoffice links are unchanged.
ALTER TABLE rewards_external.merchant_deals
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
