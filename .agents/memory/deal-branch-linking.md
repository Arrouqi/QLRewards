---
name: Deal–branch linking is by name in the DB, by id in the UI
description: How deals reference branches; DB stores names, editors must link by stable client-side ids.
---
The DB (`merchant_deals.branches` text array) stores **branch names** — this format is intentionally unchanged (manual prod migrations make schema changes costly).

**Rule:** while editing (onboarding form and admin editor), deal↔branch links use stable client-side ids (useFieldArray `id` in onboarding, `_uid` in MerchantEdit, stripped before save) and are mapped back to names at submit/save.

**Why:** react-hook-form's `useFieldArray` `fields` snapshot doesn't update while typing (caused "Branch 3" fallback labels), and name-based links silently broke when a branch was renamed.

**How to apply:** never store a branch *name* in a deal's selection during editing; read live names via `useWatch`, not the fields snapshot; map ids→names only at the submit/save boundary.
