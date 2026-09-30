---
name: GitHub push authentication
description: What to check when repository access works but pushing from Replit fails
---

When GitHub recognizes the correct account but `git push` returns 403, do not assume the account lacks repository access. The Replit Git credential and the Agent GitHub connector may have different effective write permissions. Reauthorizing the connector and retrying its write API did not help in this workspace; the user completed GitHub CLI's browser/device login, after which `gh auth setup-git` allowed normal Git authentication.

**Why:** The user could access the repository, but both Replit's Git credential and the Agent connector failed to write. GitHub CLI login worked without asking the user to paste a token into chat or requiring permission to add Replit Secrets.

**How to apply:** Check repository permissions and `gh auth status` separately, then use a user-driven GitHub CLI browser login if the Git credential is rejected. Do not print or handle tokens. Verify the remote commit and CI result after pushing; a successful push is not proof that the separate Azure deployment succeeded.