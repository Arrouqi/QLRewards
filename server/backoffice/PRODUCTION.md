# Production creation rollout

This feature targets the separate GitHub/Azure production application and external
`rewards_external` database. Do not merge a release until the following are ready.
Preparing a release is not permission to run live creation tests.

## Azure App Service configuration

Configure these application settings through the approved Azure secret/settings
interface, never source control, request bodies or a frontend build variable:

- `BACKOFFICE_TARGET=production`
- `BACKOFFICE_DRY_RUN=false`
- `BACKOFFICE_PRODUCTION_WRITES_ENABLED=true`
- `BACKOFFICE_AUTH_HEADER=Authorization`
- `BACKOFFICE_AUTH_SCHEME=Bearer`
- `BACKOFFICE_PLATFORM=0`
- `BACKOFFICE_BASE_URL=https://qlr-bo-prod.qatarliving.com` (or leave unset)
- Separate production secrets: `BACKOFFICE_PROD_USER` and `BACKOFFICE_PROD_PW`,
  or `BACKOFFICE_PROD_API_TOKEN` if the approved service account uses token mode.

Production credentials never fall back to `BACKOFFICE_USER`, `BACKOFFICE_PW` or
`BACKOFFICE_API_TOKEN`, which belong to QA. Do not reuse HAR credentials/tokens.
The production write flag is separate from `BACKOFFICE_QA_WRITES_ENABLED`.
Real production writes also require `NODE_ENV=production`.
Preview/development remains QA, with safe dry-run defaults unless deliberately
configured for QA testing. Changing targets requires a process restart.

## Verified API services

Production captures confirmed:
- Login: `https://users-be-prod.qatarliving.com/api/v4/login`.
- API: `https://qlr-bo-prod.qatarliving.com`.
- Merchant create: POST `/admin/merchant-profiles`; store `merchantProfileId`,
  not `merchantModerationProfileId`.
- Deal create: POST `/admin/offers`; store `offerId`, not `offerModerationId`.
- Filters: `/filters`; merchant profile: `/admin/merchant-profiles/:id`;
  agency branches: `/admin/:agencyId/branches`.
- Merchant signing: `https://ql-shared-prod.qatarliving.com/generateSignedURL`;
  uploads: `https://qlsharedstorageprod.blob.core.windows.net`.
- Deal signing: API `/images/generateSignedURL`;
  uploads: `https://qlrstorageprod.blob.core.windows.net/ad-images`.

Stable file references begin with `prod/`; temporary signed URLs are never saved.
Signed upload destinations are checked against the selected storage account and
exact expected path; authorization is never forwarded to Azure blob uploads.

## Database prerequisite

An authorized database operator must review and apply the additive
`migrations/0004_backoffice_actions.sql` in the `rewards_external` schema before
deployment. The existing `system_settings` table is required. No db:push, schema
replacement or unrelated pending migration is permitted.

The release workflow uses the GitHub Actions repository secret
`PRODUCTION_DATABASE_URL` for a read-only schema preflight. A repository
administrator must set it through GitHub's secure settings; the existing Replit
secret is not copied there. Hosted-runner network access and verified TLS are
required. This preflight does not apply SQL. Missing columns, credentials or
connectivity stop deployment without replacing the serving Azure app.

This release does not require saved-deal ordering or `display_order`.
Do not merge the separate ordering release just to enable backoffice creation.

## Environment isolation and existing records

Production saved mappings and transfer checkpoints have a separate
`production:` settings namespace. No QA categories, branches or prepared images
are copied into production settings. Select actual production reference options.

Production links are tagged in server-managed settings in the same transaction
as the saved remote ID. Existing untagged/QA/simulated links are blocked, not
silently cleared or treated as production. An authorized operator must verify
the original external record before any reconciliation; never blindly recreate
records. Environment/link settings cannot be changed through the generic admin
system-settings endpoint.

Merchant creation records its ID, timestamps and audit entry but keeps the portal
profile In Moderation. Moving to Created remains a separate manual action.
Offer workflow transitions and existing uncertain-result/duplicate protections
remain in place. Creation still requires staff permission and explicit confirmation.

## Verification and go-live

All automated HTTP tests use injected synthetic responses, never captured
credentials or production writes. Run QA regression tests separately from
production-target tests:

```sh
BACKOFFICE_TARGET=qa BACKOFFICE_DRY_RUN=true \
  node --import tsx --test server/backoffice/*.test.ts
BACKOFFICE_TARGET=production BACKOFFICE_DRY_RUN=true NODE_ENV=test \
  node --import tsx --test server/backoffice/production.test.ts
```

Build and review the isolated release. Verify database columns and Azure settings
before merging. After deployment, first inspect the Production environment label
and loaded reference options. Live creation of any real merchant/deal requires an
explicitly approved business record and operator confirmation, not an automatic
deployment smoke test.

To stop new production writes, set `BACKOFFICE_PRODUCTION_WRITES_ENABLED=false`
and restart through normal Azure controls; retain IDs and settings for audit.
