---
name: Merchant soft delete
description: How soft delete works for merchants and the rule for keeping deleted rows hidden
---

Merchants have a nullable `deleted_at` timestamp column. NULL = live, a timestamp
= soft-deleted. Soft delete is a HARD HIDE that is intentionally more severe than
the `archived` status: archived merchants are still visible under a filter, but
soft-deleted ones must vanish from the entire app/API.

**The rule:** every read path that returns a merchant (or merchant subresource
like notes/trainings) must verify the merchant is active. `getAllMerchants` and
`getMerchantById` filter `isNull(deleted_at)`; subresource endpoints
(`/notes`, `/trainings`, etc.) must first load the merchant via `getMerchantById`
and 404 if missing. Any NEW `/api/merchants/:id/*` endpoint must do the same or it
will leak deleted data.

**Who/when:** sales, moderation, and admin can soft-delete at any status (endpoint
`PATCH /api/merchants/:id/soft-delete`). Every soft delete is written to
`activityLogs`.

**Restore is DB-only by design** — there is intentionally no restore UI/endpoint.
Admin restores with `UPDATE merchants SET deleted_at = NULL WHERE id = '...'`; the
merchant returns to its previous status automatically (status is never overwritten,
which is why `deleted_at` is a separate column rather than a `status` value).
