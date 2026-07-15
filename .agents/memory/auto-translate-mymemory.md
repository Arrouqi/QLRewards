---
name: Auto-translate uses free MyMemory API
description: Why public-form EN→AR auto-translation uses MyMemory instead of an AI integration
---

Public forms auto-translate English → Arabic via the free MyMemory API (api.mymemory.translated.net), proxied through a rate-limited public endpoint with in-memory caching.

**Why:** The user declined the Replit-managed OpenAI integration (billing). MyMemory needs no API key. Quality is acceptable but not AI-grade; can be swapped later by changing only the server endpoint.

**How to apply:** If translation quality complaints come up, offer to swap the endpoint's upstream to an AI provider — the client hook (`useAutoTranslate`) never changes. Auto-fill must never overwrite manually edited Arabic (permanent per-field manual lock, even after clearing).
