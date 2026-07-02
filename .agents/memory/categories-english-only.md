---
name: Categories are English-only
description: User decision — business categories/sub-categories must never get Arabic names; plus prod-migration failure mode
---

**Rule:** Categories and sub-categories are English-only. Do not add `name_ar` / Arabic inputs to them, even when extending Arabic support elsewhere (merchants/deals bilingual fields are fine).

**Why:** Adding `nameAr` to the categories schema broke the user's production environment — their prod DB (deployed via GitHub, migrations run manually) lacked the `name_ar` column, so every Drizzle select on categories failed and categories "disappeared" app-wide. User explicitly asked for Arabic to be removed from categories permanently (July 2026).

**How to apply:** Any schema change here requires a matching manual SQL migration listed in replit.md — a new column in `shared/schema.ts` breaks ALL reads of that table in prod until the ALTER is run. Keep new columns out of hot shared tables unless truly needed, and always flag the migration prominently to the user.
