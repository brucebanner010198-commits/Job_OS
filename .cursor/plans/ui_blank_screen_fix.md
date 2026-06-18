# UI blank screen fix (2026-06-18)

## Symptom

Tauri/browser showed a completely white window with a black border — no sidebar, no dashboard hero, no text.

## Root causes

### 1. Corrupted `.next` build cache (primary)

Dev server logs showed repeated `MODULE_NOT_FOUND` errors loading webpack chunks, e.g.:

```
Error: Cannot find module './4996.js'
Error: Cannot find module './5611.js'
```

This happens when `.next` is partially deleted or rebuilt while `next dev` is still running (e.g. concurrent `npm run build` or `rm -rf .next`). The server returns **HTTP 500** with plain `Internal Server Error` — the Tauri webview renders this as a blank white page.

**Fix:** Stop dev server, delete cache, restart:

```bash
pkill -f "next dev"   # or Ctrl+C the dev terminal
rm -rf .next
npm run dev
```

### 2. App layout threw when Postgres was unreachable (secondary)

`app/(app)/layout.tsx` called `getAppContext()` without a fallback. When `prisma.user.upsert()` failed (DB down, wrong `DATABASE_URL`), the entire route group crashed with HTTP 500 — same blank white result in Tauri.

**Fix:** Added `getAppContextSafe()` in `lib/app-context.ts` that falls back to a synthetic **Default** profile (`OFFLINE_SCOPE_ID`) and never throws. Layout uses this and passes `dbError` to `AppShell`, which shows `DbBanner` above page content.

## Files changed

| File | Change |
|------|--------|
| `lib/app-context.ts` | `getAppContextSafe()`, `offlineAppContext()`, `OFFLINE_SCOPE_ID` |
| `app/(app)/layout.tsx` | Use safe context; graceful profile/setup reads |
| `components/app-shell.tsx` | `dbError` prop → `DbBanner` in main column |
| `app/globals.css` | Added `--destructive` / `--destructive-foreground` tokens |

## Verification

```bash
# Typecheck
npm run typecheck          # ✓ passes

# Dev server — home page must return 200 with content
npm run dev
curl -s http://localhost:3000/ | grep -E 'Job OS|Three steps'

# Offline fallback (DB down) — must still render shell + banner, not 500
DATABASE_URL="postgresql://x@localhost:5999/nope" npx next dev -p 3002
curl -s http://localhost:3002/ | grep -E 'Job OS|Database not connected|Default'
```

`npm run build` compiles and generates pages successfully; standalone trace step may fail intermittently (`output: "standalone"` for Tauri) — unrelated to the blank UI. If build fails at trace, retry after `rm -rf .next` with no dev server running.

## User checklist

1. `npm run db:up && npm run db:migrate` (if DB not running)
2. `rm -rf .next && npm run dev`
3. Open http://localhost:3000 — expect sidebar + "Three steps, then autopilot" hero
4. For Tauri: ensure dev server is on port 3000 before launching the desktop app

---

## REGRESSION (2026-06-18, second incident)

### Symptom

Blank/broken UI returned — HTTP **500** on `/`, plain `Internal Server Error` in curl (not the hydration blank-screen case).

### Root cause

**Partial Prisma 7 upgrade without regenerating the client.**

| Component | State |
|-----------|--------|
| `package.json` | `@prisma/client` / `prisma` at **7.8.0** |
| `lib/db.ts` | Prisma 7 driver-adapter pattern (`PrismaPg`) |
| `prisma/schema.prisma` | `url` removed from datasource (P7 style) |
| **Missing** | `prisma.config.ts` — `prisma generate` failed with P1012 |
| `node_modules/.prisma/client` | Stale **v6.19.3** client expecting `runtime/library.js` |
| `@prisma/client` runtime (v7) | No `library.js` — only `client.js` |

Next.js 16 Turbopack externalized `@prisma/client` and crashed at **module evaluation** in `app/(app)/layout.tsx` → `lib/app-context.ts` → `lib/db.ts` **before** `getAppContextSafe()` could run. Logo / theme / app-shell were **not** the cause.

Server stderr:

```
Error: Cannot find module '.../node_modules/@prisma/client/runtime/library.js'
  at module evaluation (lib/db.ts:1:1)
  at module evaluation (app/(app)/layout.tsx:2:1)
GET / 500
```

Contributing ops issue: stale `next dev` on port 3000 (Next 15) alongside a new instance on 3001 — always `pkill -f "next dev"` and use a single server on **3000**.

### Fix (minimal)

1. Added `prisma.config.ts` (datasource URL for CLI; matches existing `package.json` seed path).
2. `npm run db:generate` — regenerates client at v7.8.0.
3. `rm -rf .next`, single `npm run dev` on port 3000.

No revert of logo (`JobOsLogo`), theme provider, or `getAppContextSafe()` — those remain correct.

### Verification

```bash
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null
rm -rf .next
npm run db:generate
npm run dev
# wait ~25s
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # → 200
curl -s http://localhost:3000/ | grep -E 'Job OS|Three steps'
npm run typecheck   # → pass
```

**Results (2026-06-18):** HTTP 200, body contains `Job OS` + dashboard content; typecheck pass.

---

## BUILD/DEV CACHE separation (2026-06-18, durable guard)

### Symptom (recurring)

Dev server on the running port intermittently flips to HTTP **500** (`Internal Server Error`, blank Tauri/browser window). Typecheck, build, and tests are all GREEN, so this is NOT a code bug.

### Root cause

`npm run build` (or a stray `rm -rf .next`) ran while a `next dev` server was live. Both used the SAME `.next` directory, so the build deleted/rewrote webpack chunks out from under the running dev server. The dev server then could not load its chunks (`Cannot find module './NNNN.js'`) and returned 500 on every request until restarted.

Aggravating factor found this incident: leftover background "supervisor" while-loops (`AGENT_LOOP_TICK_PRODUCTION_SUPERVISOR`, and a `curl localhost:3000` watchdog) were periodically running `kill next dev; rm -rf .next; npm run dev` on a 300s timer, plus duplicate/Turbopack `npx next dev` instances grabbing port 3000. These were killed during remediation.

### Durable fix: separate output dirs for build vs dev

Production builds now write to `.next-build`; the dev server keeps `.next`. They can never touch each other.

`next.config.ts`:

```ts
// next build / next start run with NODE_ENV=production; BUILD=1 is an explicit override.
const isProductionBuild =
  process.env.NODE_ENV === "production" || process.env.BUILD === "1";
const distDir = isProductionBuild ? ".next-build" : ".next";

const nextConfig: NextConfig = {
  distDir,
  output: "standalone",
  // ...
};
```

Supporting changes:

| File | Change |
|------|--------|
| `next.config.ts` | Conditional `distDir` (`.next-build` for prod builds, `.next` for dev) |
| `package.json` | `build` -> `BUILD=1 next build`, `start` -> `BUILD=1 next start` (read the prod dir) |
| `scripts/build-standalone.sh` | Stage from `.next-build/standalone` and `.next-build/static` |
| `.gitignore` | Added `/.next-build/` |

### THE RULE (read before running a build)

1. **Builds and dev are isolated by output dir.** `npm run build` / `npm run build:standalone` write to `.next-build`. `npm run dev` uses `.next`. You may build while dev is running; it will NOT corrupt the dev cache.
2. **Never `rm -rf .next` while a dev server is live.** Stop the dev server first, or only clear `.next-build`.
3. **One dev server, one port.** Prefer port 3000. Before starting, confirm zero `next dev` running (`pkill -f "next dev"`), then `npm run dev`. Do NOT spawn duplicate `npx next dev` instances or background watchdog loops that auto-restart dev.

### Verification (2026-06-18)

```bash
# Single clean webpack dev server on 3000
rm -rf .next && npm run dev -- -p 3000
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/   # -> 200 ("Job OS")

# Concurrent build proves the conflict is gone:
npm run build          # writes to .next-build, exit 0
# while it ran, dev on 3000 stayed 200 on every poll; .next (dev) untouched, .next-build populated

npm run typecheck      # -> 0 errors
ls .next .next-build   # both present; .next-build/standalone/server.js present
```

**Result:** dev held HTTP 200 throughout a concurrent production build. Build exits 0 to `.next-build`. Typecheck 0 errors.
