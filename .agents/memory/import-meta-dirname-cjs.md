---
name: import.meta.dirname empty in CJS prod bundle
description: Why server file paths must not use import.meta.dirname in this repo's production build
---

The production server is bundled by esbuild to `dist/index.cjs` with `format: "cjs"` (see `script/build.ts`). In a CJS bundle `import.meta.dirname` is **empty/undefined**, so any `path.resolve(import.meta.dirname, ...)` throws `ERR_INVALID_ARG_TYPE` at request time and returns 500. The dev server runs via tsx (ESM) where `import.meta.dirname` works, so the bug is invisible in development.

**Why:** a deployment publish failed (autoscale health check) because new landing-page routes used `import.meta.dirname`; it worked in dev but every hit 500'd in the published app.

**How to apply:** in server code that runs in BOTH dev and prod, resolve paths with a NODE_ENV branch — `process.env.NODE_ENV === "production" ? path.resolve(__dirname, "public") : path.resolve(import.meta.dirname, "..", "client", "public")`. In the CJS bundle `__dirname` is the real Node global pointing at `dist/`, and static assets from `client/public/*` are copied to `dist/public/*` by Vite. `server/static.ts` (prod-only) already uses `__dirname`; `server/vite.ts` (dev-only) uses `import.meta.dirname`. The leftover esbuild "empty-import-meta" warning is harmless because `process.env.NODE_ENV` is define-replaced with `"production"`, so the import.meta branch is never executed.
