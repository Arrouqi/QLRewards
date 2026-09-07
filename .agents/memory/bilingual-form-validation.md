---
name: Optional Arabic form validation
description: Arabic fields are optional on public forms, with validation applied only when an Arabic deal title is entered.
---

# Rule
Arabic data-entry fields are optional on public merchant and deal forms. If an Arabic deal title is entered, it must contain at least five characters. Admin edit flows remain compatible with blank Arabic values.

**Why:** The user explicitly chose optional Arabic entry so merchants can submit English-only data, while avoiding unusably short Arabic deal titles when they do provide one.

**How to apply:** Mark every Arabic field and spreadsheet column as optional. Do not add blank-value required checks; only validate an Arabic deal title's minimum length when its trimmed value is non-empty.

# Database changes
Never run `npm run db:push` in this project — it drops the `session` table (express-session store). Apply schema changes with manual `ALTER TABLE` SQL on the dev DB, and document the same SQL in replit.md under "Pending Production Migrations" (the user runs it manually on their own production DB).
