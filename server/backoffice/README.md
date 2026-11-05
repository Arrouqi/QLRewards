# Moderator-triggered QA backoffice actions

## Safety and scope

- Nothing creates records on startup, on a timer, or when a page is viewed.
- Only authenticated `admin` and `moderation` users can invoke these actions.
- `BACKOFFICE_DRY_RUN` defaults to **true**. The adapter creates a `dry-run-*` ID
  locally and advances this portal's status; **no request is sent to QA**.
- Dry-run logs show redacted payload structure and unresolved field names, only
  outside production/test. No contact values, PINs, signatures or tokens are logged.
- The only permitted API origin is `https://qlr-bo-qa.qatarliving.com`.
  Production hosts, alternate paths, URL credentials, redirects and other origins
  are rejected. The browser backoffice origin is not the API origin.
- Real QA writes also require `BACKOFFICE_QA_WRITES_ENABLED=true`, complete explicit
  mappings and operator-confirmed authentication. Safe defaults remain dry-run
  on and QA writes off. The user has now explicitly enabled real QA-write mode
  in DEVELOPMENT only; authentication and mappings are still required. No real
  QA creation request has been sent by the agent.
- Upstream idempotency support has not been confirmed. There are no automatic
  POST retries. Timeouts, network errors, 5xx and malformed success responses
  persist `[QA_RESULT_UNCERTAIN]` and block another create until reconciliation.
  Reconcile/reset
  simulated IDs in a **test database** before testing real QA creation; never
  treat a `dry-run-*` ID as a real merchant or offer.
- No production migration, GitHub push or Azure deployment is performed for this
  implementation. Existing live data is not changed.

## Configuration

See `.env.example` for safe defaults. At the user's request, DEVELOPMENT now has
`BACKOFFICE_DRY_RUN=false` and `BACKOFFICE_QA_WRITES_ENABLED=true`.
No production settings were changed. Store the API token in environment
secrets, not source, checked-in files, logs, or chat. No credentials are needed for dry-run.
The QA browser URL `/#/merchantProfiles` is not an API endpoint.

### Confirmed QA wire contract

The user's captures confirm successful `POST /admin/merchant-profiles` and
`POST /admin/offers`, both HTTP 201. `client.ts` validates the returned
`merchantProfileId` or `offerId` and stores it as text; it does NOT substitute
`merchantModerationProfileId` / `offerModerationId` or `agencyId`.

Observed read/upload helpers:

- `GET /filters`: category/subcategory, offer-type, location and rule lookups.
- `GET /admin/merchant-profiles/{merchantProfileId}`: merchant details.
- `GET /admin/{agencyId}/branches`: branch IDs; this path uses **agencyId**.
- `GET /images/generateSignedURL?path=...`: offer image upload signing.
- `https://ql-shared-qa.qatarliving.com/generateSignedURL`: merchant upload signing.

No Authorization/cookie values were present in the captures. The user separately
confirmed that QA browser requests use `Authorization: Bearer`. Development is
configured with `BACKOFFICE_AUTH_HEADER=Authorization` and
`BACKOFFICE_AUTH_SCHEME=Bearer`; `BACKOFFICE_API_TOKEN` belongs only in secure
configuration. Both successful create captures include `platform: 0`; configure
`BACKOFFICE_PLATFORM=0` for these QA requests. Browser tokens can expire and may
need replacement through secure entry in manual-token mode.

Preferred QA authentication uses `BACKOFFICE_USER` and `BACKOFFICE_PW` from
Secrets to POST `{username,password}` to the user-confirmed fixed endpoint
`https://users-be-qa.qatarliving.com/api/v4/login`. Its observed HTTP 201 response
contains a root `token`. Tokens are server-memory-only, shared between merchant
and offer actions, cached for at most five minutes (or until one minute before
JWT expiry), and obtained again on demand. No refresh-token endpoint is assumed.
Both login secrets take precedence over `BACKOFFICE_API_TOKEN`; a partial pair
or failed login blocks creation, without falling back to a stale token.
Dry-run, disabled writes, invalid origins and incomplete mappings do not log in.
HTTP 401 clears the cached token for the next explicitly triggered action;
creation POSTs are never automatically replayed. No credentials or login response
bodies are exposed to clients or logs. Do not paste passwords into chat; rotate
any exposed credentials and update Secrets. This does not enable production writes.

`BACKOFFICE_MAPPING_JSON` is legacy configuration and ignored for both merchant
and offer creation. Staff must save each request's actual QA details; environment
fixtures cannot override identity or supply missing business data.
See `contracts.ts` for observed payload types and `mapMerchant.ts` /
`mapOffer.ts` for direct portal-field mappings. These are intentionally
conservative validators for the captured examples, not complete API documentation.
Never paste captured contact data, credentials, PINs or signed URLs into code.
Treat mappings containing contact details or PINs as sensitive configuration.

### Actual merchant details

Every merchant uses the same source-to-QA mapping rules. Business Name maps to
Brand Name, not the legal company name. The staff form prefills only that
merchant's actual submitted brand, business contacts, registration and assets;
staff supply missing actual values and the business description.
Required: registered QA owner email (`userEmail`, distinct from business email),
brand/business name, business email, phone and WhatsApp, category, logo, cover
image, business description, CR number and CR document reference, and each
branch's name, phone, QA location and map URL. No synthetic owner/contact/profile
defaults are used. New agencies use the observed protocol value `agencyId=0`;
existing agency selection is an explicit optional advanced choice.
Working hours are optional and omitted from the payload when not supplied.
If enabled, all seven days must be valid. Non-CR documents are optional and only
their available, confirmed fields are mapped; document URLs are not treated as
registration codes. Redemption and price-list settings are optional; disabled
redemption does not require a PIN.
Categories and locations are read-only lookups from the confirmed QA `/filters`.
The server verifies selected IDs against these lookups when saving.
Group merchants explicitly select a submitted brand, never the legal group name
as a fallback or the first brand automatically. Actual business details must be
entered for that selected brand.

`GET/PUT /api/merchant-requests/:id/qa-details` are admin/moderation-only.
QA setup may be edited while Pending or In Moderation, before a QA merchant is
linked and without an uncertain creation result. Preparing details does not
advance status or create a QA merchant; remote creation still requires In
Moderation.
Details persist in the existing settings table under a scoped key; no schema
migration is needed. Generic settings endpoints cannot access these keys.
Soft-deleted merchants remain hidden; linked/uncertain records are locked, and
updates are audited without contact information or PIN values. Responses have
no-store caching and are excluded from response-body logging. Saving details
does not call a remote creation API or alter the portal's submitted branches.
Missing/invalid details disable creation, including simulated creation, before
any remote write. Source-data problems are surfaced rather than substituted.
Establishment/trade document URLs are NOT registration numbers/codes.

### Actual offer details

#### Reusing submitted deals and creating them

The offer action is labelled **Create deal**. It confirms the current draft,
calls protected `POST /api/deal-requests/:id/qa-prepare`, verifies newly saved
readiness, and only then calls the existing guarded create endpoint. An incomplete
saved setup does not prevent starting preparation, but missing fields, unavailable
options or failed uploads stop before creation. Viewing a page never uploads or creates.

Read-only details include source-derived prefills, submitted images and
unresolved-field guidance. Saved corrections take precedence, including zero
values and intentionally empty selections; background reloads do not overwrite
the draft. Category/subcategory, deal type and branch selection use unique current
QA option names, with branches scoped to the verified merchant agency. Known deal
type labels map to QA's captured names, not fixed numeric IDs. Ambiguous/unmatched
choices remain explicit. Claim rules match verified claim options; general rules
select payment conditions only when their labels match verified options. Terminal
full stops are ignored for rule matching, but fuzzy matches and ambiguous labels
are not guessed. All original terms are also preserved as text.

The submitted original price populates QA price, including zero. Known Unlimited
and Limited values map to the QA uncapped/capped redemption types respectively;
limited counts are taken from the actual submission, not a default count.
Captured all-offer responses distinguish type 1 with null caps from type 2 with
explicit caps. Unknown labels are not converted. Saved corrections take priority.
The QA selector explicitly maps Monthly Offer to 1 and Yearly Offer to 2.
Explicit submitted "1 Month" and "1 Year" labels map to these codes; unknown
durations remain unconverted, and date spans are never used as a substitute.
The original duration remains visible. A missing start date is not invented.

Preparation accepts `{details, useSourceImages}`. Client image fields accept only
stable QA offer keys, never client-supplied download URLs. With submitted-image
reuse selected, source URLs come only from the stored deal. Trusted transfers pin
`https://qlrstoragedev.blob.core.windows.net/deals-clients/` and its offer-image
folders; redirects, URL credentials, signatures, document folders, alternate hosts
and unbounded downloads are rejected. Content type/signature, 5 MB limit and
timeouts are checked before the existing QA uploader handles the bytes.
Legacy direct uploads under the stored deal ID and onboarding uploads under
`merchant-<storedMerchantId>-deal/` are supported too, with exact record/merchant
folder scoping. Foreign deal/merchant folders are rejected.
Unsupported source URLs require an explicit replacement rather than unsafe fetching.

Completed transfers are checkpointed in protected, source/deal-scoped settings
under `qa_offer_transfers:`. Keys hash the actual parent profile and source URL,
so another parent cannot reuse that association. Checkpoints commit on a later
transfer failure, but partial setup is not saved and no creation follows.
Retries reuse completed stable references; no automatic creation retries occur.
No schema migration is required. Generic settings access cannot read or alter
these keys. Existing lock, role, soft-delete, uncertain-result, status and QA-write
guards remain authoritative. Final create readiness refreshes QA options.

Both standalone and nested offers use GET/PUT
`/api/deal-requests/:id/qa-details`, GET `.../qa-options` and POST `.../qa-images`.
Details persist in existing settings, scoped by source table and request ID.
No schema migration is needed. The generic settings endpoint cannot access these
records. Responses are no-store and excluded from response-body logs; audits
contain field names/counts, not offer text or image signatures.

Preparation requires a real primary QA merchant link. Simulated parent IDs cannot
verify branches, even in dry-run. Parent changes invalidate saved details: staff
must explicitly review and select the new parent's branches before saving.
Taxonomy comes from `/filters`, including nested `subCategories`, offer types,
claim rules and payment conditions. Branch discovery first reads
GET `/admin/merchant-profiles/:merchantProfileId`, verifies the returned primary
profile ID and resolves its positive numeric `agencyId`. It then calls
GET `/admin/:agencyId/branches` returning `[{id,name,locationName}]`.
The two identifiers are not interchangeable; the offer payload and saved parent
binding continue to use `merchantProfileId`, not `agencyId`.
Only branch IDs/names for the verified association are exposed. A failed branch lookup
blocks save/create instead of accepting arbitrary IDs. Selections are checked
again before creation using bounded read caches.

The offer save button and handler share the same prerequisite checks. The form
lists every save blocker, permits validation of a prefilled but never-saved draft,
and exposes explicit parent review even when the merchant link changes before
the first save. Read-only details include a safe edit-blocking reason.
“Reload QA options and branches” calls the protected options endpoint with
`?refresh=1`, bypassing the taxonomy cache and the current parent's combined
profile-to-agency/branch cache. This association is re-resolved with every branch
reload (normally cached together for 60 seconds, up to 100 profiles).
Forced reloads supersede older pending reads, which cannot refill the caches;
simultaneous current reads are deduplicated. Normal readiness checks retain bounded caches. Failed verification is
distinct from a successfully verified empty branch list; neither permits manual
branch IDs. Explicitly clearing unavailable selections retains other entered
values and never substitutes new IDs. Input and error IDs are unique per form,
including when multiple offers are rendered on the same merchant page.

Price, redemption settings and savings are prefilled from actual business values.
Only known redemption labels are converted; unknown labels remain actionable.
Duration selector codes are taken only from the confirmed Monthly/Yearly QA
options, never inferred from numeric examples or the date interval.
Arabic title/description are optional but preserved when provided. Dates remain
real `YYYY-MM-DD` calendar strings without local-time conversion. Image ordering
starts at 1; empty claim/payment selections are explicitly permitted. Non-empty
weekday codes, non-null tranche settings and redemption-period codes remain
unconfirmed and blocked. A source per-user limit requires an explicit count.

Only Pending, Approved or In Moderation unlinked/non-uncertain offers can be
prepared/created. Saving details does not change status or create anything
remotely. Missing/unverified details disable creation before the adapter,
including simulated creation. Save/Create are blocked during uploads. Explicit
Create deal confirmation prepares and saves unsaved edits before checking fresh
readiness; an unsaved draft is never sent directly to the creation adapter.

Offer images use a **different** contract from merchant files: GET the fixed QA
backoffice `/images/generateSignedURL?path=<uuid>/<unique-file>` endpoint, then
PUT only to `https://qlrstorageqa.blob.core.windows.net/ad-images/qa/<uuid>/<unique-file>`.
The response is an array of `{path,signedUrl}`; `path` matches the unprefixed
request path. Only the permanent `qa/<uuid>/<unique-file>` key is persisted.
Uploads for the same submitted deal use its stable UUID folder.
When QA creates an offer it rewrites each image URI to its new numeric offer
ID folder, but may only copy the first image. After confirmed creation, the
service verifies every final path and copies missing blobs from the uploaded
source keys using the QA signer; it never overwrites a blob already present.
If verification fails, the created offer ID is retained and further creation
is blocked; repair the existing QA deal rather than replaying creation.
PNG/JPEG/WebP allow 5 MB each with binary format checks. Staff can order/remove
images or supply existing stable offer keys. Portal URLs, merchant-file keys and
signed URLs are rejected. The local safety cap is 30 images; four is not inferred
as a business requirement from the HAR.

Signing responses/timeouts are bounded; origin/container/path are pinned.
No redirects, QA credential forwarding to Azure, captured SAS reuse, arbitrary
downloads or automatic retries occur. Failures add no image key. Navigating away
aborts browser uploads and suppresses stale callbacks; unused blobs may remain
if staff leave without saving.

The newest HAR already created QA offer **4060** (moderation ID 4361) for
merchantProfileId **2259**. Do not replay it or infer its portal linkage by names
or the currently viewed page. No remote creation or automatic import/linkage was
performed while implementing this workflow.

The earlier development-only synthetic merchant fixture is no longer used by
merchant creation and is not migrated into actual merchant details. Do not assume
a synthetic contact address is a registered QA account. An earlier operator's 404
body was discarded, so its exact missing resource is unknown; subsequent 404s
classify known resource errors into static messages without echoing private
upstream content. Local validation does not prove the remote account exists or
has creation permission. The agent has not sent a creation request.

### QA merchant file uploads

Explicit merchant creation also transfers the merchant's own submitted logo,
cover and CR from approved portal document storage when they are not yet QA
keys. Automatic reads require an exact match to that merchant's saved source
field, the fixed storage origin and document folder, with no redirects,
credentials, query strings or fragments. Size limits and MIME/content signatures
are verified. Existing QA keys and operator corrections are preserved.
Each successful transfer is saved before continuing, so a failed transfer retry
does not upload completed files again. No merchant is created until all three
references are ready. Read-only details/readiness requests and dry-run creation
never download or upload source assets. Unsupported external URLs still require
an explicit QA file upload.

The staff form supports explicit local-file uploads for logo, cover and CR through
`POST /api/merchant-requests/:id/qa-files/:kind`. This is separate from merchant
creation and from saving details. The merchant must be Pending or In Moderation, not deleted,
not linked and not uncertain; only admin/moderation can upload. Actual uploads
require the existing QA write opt-in and dry-run off. No simulated keys are made.

PNG/JPEG/WebP images allow 5 MB. CR accepts those formats or PDF up to 10 MB.
The server checks content signatures and declared MIME types before authenticating.
It obtains a fresh signed URL from the fixed QA shared signing endpoint: logo and
cover use observed `fileType=2`, CR uses `fileType=4`, with empty `mimeType`.
Logo requests use `default/<unique-name>`, cover/CR use `0/<unique-name>`.
The signing response is an array containing `{path,signedUrl}`; `path` matches
the requested path without `qa/`, while the merchant payload key adds `qa/`.
Uploads use a direct Azure `PUT` with `x-ms-blob-type: BlockBlob` and detected MIME.

Only the exact QA storage origin, expected `logos` or `license-files` container,
and generated path are permitted. No redirects, credential forwarding to Azure,
captured SAS reuse, automatic retries, arbitrary remote-file downloads or logging
of signed URLs is allowed. The browser receives only a stable `qa/...` key.
Failed uploads do not replace the form reference. Save/Create are disabled while
uploads are pending; navigating away aborts the browser request and suppresses
stale callbacks. Upload success does not persist details until the operator saves.
Unused uploaded blobs may remain if the operator leaves without saving.

Validation accepts QA keys, existing permanent HTTP(S) URLs and root-relative
portal references; signed upload URLs cannot be saved. Portal URLs are not
automatically copied or guaranteed reachable by QA—reupload the original file
through the QA controls when needed. Offer upload signing is not implemented.
The two captures already contain a real merchant and an offer linked to it.
Those records have not been replayed, imported or automatically linked.

## Requests and data

`/api/merchant-requests/:id` refers to the existing `merchants` table.
`/api/deal-requests/:id` supports existing `deals` and `merchant_deals` UUIDs.
The merchant is looked up by the deal's stored `merchantId`, **never by matching
names, email or telephone**. Standalone deals with no portal merchant linkage
cannot be created until a merchant is linked. Soft-deleted merchants stay hidden.

Each prefix exposes `GET /backoffice` for metadata. POST endpoints are:

- `/api/merchant-requests/:id/create-merchant`
- `/api/deal-requests/:id/create-offer`

POST has no body. Payload fields are loaded from the database and mapped by
`mapMerchant.ts` / `mapOffer.ts`. Complete normalized source snapshots are retained
internally; only confirmed wire-contract fields are sent. Portal fields without
a confirmed QA equivalent (for example signatures/fees) are not invented upstream.
Backend-managed IDs/errors are excluded from ordinary form/edit input schemas.

Merchant creation requires `moderation` and preserves that workflow status.
The backoffice ID, creation timestamp and audit entry still record success.
Moving a profile to Created remains a separate manual workflow action.
Offers require a merchant's backoffice ID and advance to `licensing`.
Repeated successful actions return the same ID with HTTP 200, including after
the initial status transition. Ineligible unlinked requests return 409.

PostgreSQL row locks serialize concurrent attempts. Successful linkage, status
and the existing activity-log row are saved in one transaction. The audit includes
actor, time, source request ID, source table, dry-run flag and backoffice ID.
Typed adapter failures return 502 and commit only error/attempt metadata, leaving
status and linkage unchanged. A safe retry clears the previous error on success.
Ambiguous remote results cannot be retried until reconciled. If a known remote
success cannot be saved locally, a recovery transaction records its known primary
ID in the error and blocks retries. If the database is unavailable even for this
recovery, the operator must reconcile that reported ID manually before creating
again. No distributed exactly-once guarantee is claimed without upstream support.
Unexpected database errors return a generic response without leaking SQL values.

## Database and backup

`migrations/0004_backoffice_actions.sql` contains additive nullable fields for all
three request tables. It has been applied only to Replit's **development** DB.
Production is separate: an authorised operator must back up that database, apply
the SQL manually using the `rewards_external` search path, then deploy only when
approved. The SQL is also listed in `replit.md`. Do not use `db:push`.

The pre-change tracked-source snapshot is stored locally at:
`generated-artifacts/project-before-backoffice-actions.tar.gz`.
It is ignored by Git/deployment and is a **source backup, not a database backup**.
To inspect/restore it, extract into a separate directory and compare before
replacing anything; do not extract over a running application.

## Checks

```sh
NODE_ENV=test BACKOFFICE_DRY_RUN=true BACKOFFICE_QA_WRITES_ENABLED=false \
  npx --no-install tsx --test server/backoffice/*.test.ts \
  client/src/components/BackofficeAction.test.ts \
  client/src/components/MerchantQaDetailsForm.test.ts \
  client/src/components/QaFileUpload.test.ts \
  client/src/components/OfferQaDetailsForm.test.ts \
  client/src/components/OfferQaDetailsForm.interaction.test.tsx \
  shared/employeeFeedback.test.ts server/employeeFeedback.test.ts
npm run build
npm run check
```

Tests use an isolated in-memory transactional repository and isolated HTTP server:
transport tests use an injected fake fetch. There are no real customer data,
emails, backoffice calls or database writes. They cover
roles, guards, duplicate/concurrent attempts, both deal sources, failure/retry,
audit atomicity, soft deletion, mappings, primary-vs-moderation IDs, QA-host/write
guards, safe errors, ambiguous-result handling and protected input fields. Server-rendered
component checks verify role-based visibility, disabled/enabled states, saved IDs
and escaped errors; they do not replace signed-in browser interaction testing.
The interactive offer tests mount the real components in JSDOM with an isolated
QueryClient and strictly mocked fetch. They cover successful save/reload,
field validation, exact save blockers, forced options refresh, parent review,
multiple offers, save/upload failures, navigation and Create guards. They never
use real staff credentials, connect to QA storage or create remote records.
The project-wide type check has existing unrelated failures; do not confuse
those with new backoffice errors.

Manual development check, using a test merchant and existing normal login:

1. As a moderator/admin, open a merchant in **In Moderation**.
2. Click **Create Merchant**, confirm, and check the dry-run notice, saved ID,
   unchanged **In Moderation** status and activity log. Reload; the create button stays hidden.
3. Check an offer before step 2: its button is disabled with
   **Create the merchant first**. After step 2, click **Create Offer**, confirm,
   and check its saved simulated ID and **Licensing** status.
4. Sales/other users must not see these controls; their API attempts return 403.

The simulated `BackofficeError` test verifies unchanged status, saved error, and
successful retry without adding a public failure-simulation switch.
