---
name: Production migrations are manual
description: How DB schema changes reach the user's production environment
---

"Production" for this user is their OWN separate server + database, deployed via
GitHub — NOT the Replit-published version. The Replit environment is dev/testing
only.

**The rule:** any schema change (new column/table) must be listed as hand-written
SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) in replit.md under a
"Pending Production Migrations" section, so the user can run it on prod before
deploying. Never assume migrations auto-apply to prod, and never rely on db:push
for prod.
