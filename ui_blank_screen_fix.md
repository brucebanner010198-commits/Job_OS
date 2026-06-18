# Blank white screen / HTTP 500 fix — Job OS UI

**Status:** FIXED (2026-06-18, verified)

## Symptom

Opening `http://localhost:3000` showed HTTP **500** with plain `Internal Server Error` in the HTML (or a blank white page in Tauri). No sidebar, no dashboard hero.

## Root cause (this incident)

### Primary: corrupted `.next` dev cache

Dev server logs on `GET /`:

```
Error: ENOENT: no such file or directory, open '.next/dev/server/app/(app)/page/build-manifest.json'
Error: Cannot find module '../chunks/ssr/[turbopack]_runtime.js'
Persisting failed: Another write batch or compaction is already active
GET / 500
```

**Trigger:** `.next` was deleted or rebuilt (`rm -rf .next`, `npm run build`) while `next dev` was still running, or multiple `next dev` processes competed on ports 3000/3001. Turbopack/webpack cache became inconsistent; the server returned 500 before any React code ran.

**Not the cause this time:** Prisma client was already v7.8.0 (`npm run db:generate` OK). Layout already uses `getAppContextSafe()`.

### Secondary (already fixed in code): DB-down layout throw

Previously, `app/(app)/layout.tsx` called `getAppContext()` directly. When Postgres was unreachable, `prisma.user.upsert()` threw and the route segment returned HTTP 500 — same blank result in Tauri.

## Fix

### Operational (required for corrupted cache)

```bash
# 1. One dev server only
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null

# 2. Clean cache
rm -rf .next

# 3. Regenerate Prisma client (if you see library.js / P1012 errors)
npm run db:generate

# 4. Single dev server
npm run dev
# wait ~25s for first compile

# 5. Must return 200 with dashboard content
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/   # → 200
curl -s http://localhost:3000/ | rg "Job OS|Three steps|Continue setup"
```

### Code (DB-down resilience — already in repo)

| File | Change |
|------|--------|
| `lib/app-context.ts` | `getAppContextSafe()` → synthetic `OFFLINE_SCOPE_ID` profile on any DB error; never throws |
| `app/(app)/layout.tsx` | Uses `getAppContextSafe()`; wraps `listProfiles` / `getSetupStatus` in try/catch |
| `components/app-shell.tsx` | `dbError` prop → `DbBanner` above page content |
| `app/(app)/page.tsx` | `safeDb()` for metrics/setup with preview fallbacks |
| `prisma.config.ts` | Prisma 7 datasource URL for CLI (`prisma generate` / migrate) |
| `lib/db.ts` | Prisma 7 driver adapter (`PrismaPg` + `pg` Pool) |
| `next.config.ts` | `serverExternalPackages: ["@prisma/client", "prisma"]` |

## Verification (2026-06-18)

```bash
rm -rf .next && npm run dev
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # 200
curl -s http://localhost:3000/ | rg "Job OS|Three steps|Continue setup"  # all present
npm run typecheck   # pass
npm run build       # pass
```

## Offline / DB-down behavior

With Postgres stopped or bad `DATABASE_URL`, the shell and dashboard still render using offline scope + preview data. A `DbBanner` prompts `npm run db:up`.

```bash
DATABASE_URL="postgresql://x@localhost:5999/nope" npx next dev -p 3002
curl -s http://localhost:3002/ | rg "Job OS|Database not connected|Default"
# Expect 200, not 500
```

## Prevention checklist

1. **Never** `rm -rf .next` while `next dev` is running — stop the server first.
2. **One** dev server on port 3000 (`lsof -ti:3000,3001 | xargs kill -9` before restart).
3. After Prisma upgrade: `npm run db:generate` before `npm run dev`.
4. `npm run db:up && npm run db:migrate` when DB is needed for real data.

## Prior incidents (same file)

- **Blank white screen (no 500):** missing body `bg-background` styles, layout throw before safe context — fixed with `getAppContextSafe()` + theme classes.
- **Prisma 7 regression:** stale v6 client missing `runtime/library.js` — fixed with `prisma.config.ts` + `db:generate`.
