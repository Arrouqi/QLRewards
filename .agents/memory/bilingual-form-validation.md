---
name: Bilingual (EN/AR) form validation split
description: How Arabic-field requiredness is enforced on public vs admin paths, and why db:push must never be used here.
---

# Rule
Arabic data-entry fields (companyNameAr, brandNameAr, deal titleAr) are required only on PUBLIC submission paths. Admin edit flows intentionally keep the base insert schemas because admin UIs don't collect Arabic fields.

**Why:** Enforcing Arabic requiredness on shared insert schemas would break admin merchant-edit/deal flows that predate the bilingual feature. `insertDealSchema.partial()` is also used for updates, so refined (ZodEffects) variants must be separate exports (`publicDealSubmissionSchema`, `publicMerchantDealSchema`), not replacements.

**How to apply:** When adding required fields to public forms, create a `.superRefine(...)` variant of the insert schema for the public route only; leave base schemas untouched for `.partial()`/admin usage.

# Database changes
Never run `npm run db:push` in this project — it drops the `session` table (express-session store). Apply schema changes with manual `ALTER TABLE` SQL on the dev DB, and document the same SQL in replit.md under "Pending Production Migrations" (the user runs it manually on their own production DB).
