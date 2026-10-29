-- Run against the application's schema BEFORE deploying the sorting update.
-- Production uses rewards_external; set that search_path in the SQL session.
-- No records are deleted; IDs, statuses and backoffice links are unchanged.
ALTER TABLE merchant_deals
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;
