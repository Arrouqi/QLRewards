# Deploy the saved-merchant deal-ordering update

This repository deploys to Azure from `main`. The workflow now runs:
**build → ordering migration → deploy**. A failed or skipped migration blocks
deployment; the currently serving Azure version is not replaced.

## Required setup before merging

1. A repository administrator opens **Settings → Secrets and variables →
   Actions → New repository secret**.
2. Add **PRODUCTION_DATABASE_URL** containing the external production
   PostgreSQL connection string used by the Azure application. Do not use the
   Replit development database, put the value in code/chat, or print it in logs.
3. Confirm this database contains `rewards_external.merchant_deals`.
   The database login must be allowed to ALTER that table.
4. Ensure GitHub's hosted Ubuntu runner can reach the database and its TLS
   certificate is trusted. The runner enforces certificate verification even
   if the connection string requests weaker TLS. Do not disable TLS or broadly
   open a firewall to fix access; use an approved network path/runner if needed.
5. Review the complete draft PR, mark it ready and merge when approved.
   No manual SQL execution is required once this workflow is configured.

The Replit secret is **not** automatically copied to GitHub. An administrator
must supply the GitHub secret through GitHub's secure settings.

## Exact migration and safety

`script/migrate-deal-order.mjs` executes only
`migrations/merchant-deal-order.sql` inside a transaction, then verifies that
`display_order` is an integer, NOT NULL, default 0 before committing.
It does not run db:push or any other pending migrations.
It has bounded connection, query and lock waits. Failure rolls back; errors
are deliberately generic to avoid leaking connection credentials.
Existing deal content, IDs and links are not deleted or recreated.

If the column already exists with the correct definition, rerunning is safe.
An incompatible column requires investigation, not automatic repair.
If deployment later fails, the additive column remains compatible with the old
app; do not delete it. Diagnose the failed job, then rerun the workflow from
`main`. Manual dispatches on non-main branches are skipped.
Runs are serialized so migrations/deployments do not overlap.

After build, migration and deployment are green, test **Filli → Edit → Deals →
arrows → Save Changes → reopen** on the live site.

## Verification limits

The migration safeguards have automated mock-client tests. These do not prove
GitHub can reach production. No production migration or deployment is performed
while preparing this PR.
