# Job OS — Product Completeness & Local-Hosting Review (2026-07-07)

Scope: completeness, local-hosting reliability, resilience, maintainability, and UI/UX polish. Findings verified against the code (file paths cited). This complements `docs/AUDIT-2026-07-07.md`; overlapping claims were independently re-verified.

---

## 1. Verdict in one paragraph

The engineering core is stronger than most local-first hobby apps: the DB-down read path is genuinely resilient (`lib/safe.ts`, lazy Prisma proxy in `lib/db.ts`), the apply flow is the best-hardened code in the repo, the scheduler is idempotent, and the design system is consistent with real loading/empty/error states. What keeps Job OS from feeling like a finished product is the **shell around the app**: a 7-step terminal install with no preflight checks, a Tauri desktop build that cannot currently work, no update story, several silent failure modes (hung fetches, masked Gmail sync failures, invalid keys that look valid), and developer jargon leaking into nearly every primary screen. Fixing the top ~10 items below changes it from "impressive developer tool" to "product."

---

## 2. Immediate action (do this today)

**Rotate your live secrets.** `.env` in the working tree contains a real OpenRouter key (`sk-or-v1-...`), Gmail client ID + secret, and a personal email. `.secrets/keys.json` and `.secrets/backup.key` also sit on disk. `.env` is gitignored, so nothing leaked via git, but these were exposed in review tooling. Rotate the OpenRouter key and Gmail client secret, and keep `.env` as placeholders only.

---

## 3. Critical findings (block launch or cause silent failure)

### 3.1 The desktop (Tauri) build is broken by construction
- `src-tauri/tauri.conf.json` bundles `../.next/standalone`, but the production build writes to `.next-build/standalone` (`next.config.ts` sets `distDir=".next-build"` when `BUILD=1`). The app packages a missing or stale server → blank window.
- `src-tauri/src/main.rs` runs `Command::new("node")` with stdout/stderr sent to `/dev/null`. GUI-launched macOS apps don't have `node` on PATH, so the sidecar silently never starts, and all diagnostics are discarded. No bundled Node runtime (`bundle.externalBin` absent); `src-tauri/README.md` itself says "Status: scaffold."
- Hardcoded `PORT=3000`, no port-conflict handling.

Since README calls the macOS desktop app the *primary target*, this is the single largest completeness gap.

### 3.2 No timeouts on any external call
- `lib/ai/openrouter.ts` `chat()`/`chatJson()`, `lib/ai/embeddings.ts`, and **all** job sources (`lib/jobs/sources/`) call `fetch` with no timeout. `discover()` uses `Promise.allSettled`, so one hung vendor stalls the entire discovery cycle indefinitely — including inside autopilot and catchup.
- The correct pattern already exists in `lib/brief/fetch-utils.ts` (`safeFetch`: 12s abort, size cap, SSRF guard) but was never generalized.

### 3.3 The pg Pool can crash the process
`lib/db.ts:24`: `new Pool({ connectionString })` — no `max`, no connect/idle/statement timeouts, and **no `pool.on('error')`**. A Postgres restart emits an unhandled `'error'` event that can take down Node. `pingDatabase` also has no connect timeout, so `/api/health` can hang.

### 3.4 Failures recorded as success
`lib/scheduler/run-job.ts:22`: the `gmail-sync` job hardcodes `status:"ok"` regardless of `syncInbox()`'s returned `r.ok`. Combined with watermarks advancing on failure and no backoff/alerting, a revoked Gmail token is invisible forever. Separately, autopilot's last-run status lives in a module-level variable, so runs triggered by the catchup process never show in the web UI.

### 3.5 Invalid API keys are indistinguishable from "no data"
- JSearch (and other sources) swallow non-OK responses into `[]` — an expired key looks like "no jobs found."
- The Integrations portal saves any key with a green "Saved" check; only OpenRouter is ever actually probed (`/api/integrations/verify`), and only in a separate panel. For an app whose value depends on working keys, save-without-validate is a trust problem.
- Inconsistent contracts: missing OpenRouter key **throws** a raw error from `chat()`, while `embedText()` returns null silently. Users can see raw strings like `OpenRouter 401: ...`.

### 3.6 No preflight, no enforcement of prerequisites
No `engines` field in package.json, no `.nvmrc`, no Docker-running check, no port-free check, no doctor command. Every prerequisite failure surfaces as a runtime 503 or an opaque npm error. README's "~10 minutes" is only true on a perfectly prepared machine.

---

## 4. High-priority findings

### 4.1 Install & migration guidance contradicts itself
README/DEPLOYMENT say `npx prisma migrate deploy` (correct), but `npm run db:migrate` = `prisma migrate dev`, and the on-screen `components/db-banner.tsx` tells users to run `db:migrate` — which on a fresh DB may try to create a shadow DB or prompt a reset. Pick one path (deploy) everywhere.

### 4.2 No update story
Nothing applies migrations on launch; a `git pull` runs new code against an old schema silently. No Tauri updater. Version `0.1.0` hardcoded in three places (package.json, Cargo.toml, tauri.conf.json).

### 4.3 launchd agents fail silently
`lib/scheduler/agents.ts` points logs at `<cwd>/.logs/catchup.log`, but nothing ever creates `.logs/` — launchd can't write there, so scheduled agents fail to launch or lose diagnostics. Also: recurring jobs are entirely manual (`npm run catchup`) unless the user discovers `npm run install:agents -- --load`; no non-macOS equivalent.

### 4.4 Secrets file store has a lost-update race
`lib/secrets/file-store.ts` `saveKeys` is read-modify-write with no lock and no atomic temp-rename. Concurrent portal saves drop keys; a crash mid-write truncates `keys.json`.

### 4.5 Fixture data silently substitutes for real data
On an empty-but-healthy DB, the Jobs page shows fixture postings; Apply shows fixture plans. It's labeled, but the substitution happens at the data layer and reads as "half-configured" rather than intentional. A brand-new user sees fake jobs before doing anything.

### 4.6 Jobs never expire
`listQueue` returns all non-excluded jobs regardless of age; nothing prunes dead listings, re-verifies URLs, or shows staleness. The brief-facts staleness logic (`lib/brief/volatile.ts`) is not applied to jobs.

---

## 5. UI/UX findings

The design system is solid (token-based light/dark themes, shared primitives, real mobile drawer, per-page DB banners, complete 4-step setup wizard with good aria usage). The problems are language, hierarchy, and feedback:

1. **Developer jargon on primary screens.** Apply page header shows `driver: real Chrome - armed` / `dry run`; sidebar shows `Fixture` / `Partial` / `Adapter` badges; DbBanner tells users to start Docker Desktop and run `npm run db:up`; Jobs stats say "dupes / ghosts / scams"; autopilot callout renders the raw enum `AUTONOMOUS`; Backups page exposes launchd/npm commands; Integrations page mentions `.secrets/keys.json`. A job seeker should never see the words driver, fixture, adapter, Postgres, launchd, or npm. Replace with plain language or move behind an "Advanced" toggle.
2. **Navigation is overwhelming and split.** A 6-stage pipeline rail plus a collapsed "Settings & tools" accordion hiding 13 more destinations; Outcomes appears in both; core setup actions (Import resume, Master resume, Goals) are buried under a "Modules" sub-header. Of ~17 registered modules only 9 are "live" — half the nav advertises incompleteness via its own status badges. Fold setup modules into the Setup stage, de-duplicate, and hide non-live modules by default.
3. **No key validation feedback** (see 3.5). Add a per-key "Test" that actually probes each provider and shows pass/fail inline.
4. **DB-down banner strands non-technical users.** In the desktop build the DB should be managed automatically; in web mode the banner needs plain-language guidance plus a "copy the fix commands" expander for technical users.
5. **Accessibility gaps:** status conveyed by color/symbol alone (pipeline dots, ✓/○ checklists, badge states); no skip-to-content link; mobile drawer lacks a focus trap. Baseline (focus rings, aria on menus/wizard, semantic landmarks) is good.
6. Minor: inconsistent color-token usage (`text-[var(--danger)]` inline vs tokenized classes); `local-first-badge` tooltip mentions "Postgres."

---

## 6. Weak assumptions, challenged

- **"Desktop is the primary target"** — but the desktop build cannot start today, while the web quickstart works. Either fix the Tauri path/sidecar/logging chain (§3.1) or reposition web-first honestly until it's done.
- **"Fixtures make the app demoable"** — true, but silent fixture substitution undermines data trust, the very thing a job pipeline needs. Fixtures should be an explicit demo mode, not a fallback.
- **"Users will run npm run catchup"** — they won't. Without an in-app scheduler (or working launchd install), autopilot/discover/backup effectively don't exist for real users.
- **35 bespoke `test:*` scripts, no test framework.** Each is a hand-rolled tsx script; nothing runs them all, no CI gate visible for the suite. This is a growing maintenance tax — consolidate under one runner (even a simple `test:all` + vitest migration path).
- **`AUTONOMOUS` route is structurally unreachable** through `buildApplyPlan` (router blocks it whenever critical fields exist, and they always do). A large advertised feature is dead in practice — either make it reachable behind the quality gates or remove the claim.
- **Two build caches (`.next`, `.next-build`) + three stray `tsbuildinfo` files in root** — a recurring source of the blank-screen bug the repo already documents (`ui_blank_screen_fix.md`). Unify to one distDir.
- **`scripts/supervisor-loop.sh`** hardcodes your personal machine path and shouldn't ship.

---

## 7. Install / launch / lifecycle approaches compared

| Approach | How it works for Job OS | User experience | Dev experience | What breaks | Maintenance | Fit |
|---|---|---|---|---|---|---|
| **Tauri desktop app** (current aim) | Bundle Next standalone + Node sidecar; manage Postgres or replace it | Best possible: double-click, no terminal | Hardest: sidecar bundling, code signing, updater, per-OS builds | Currently everything (§3.1); long-term: signing, Node bundling, DB management | High | **Right end goal, wrong first step.** Ship only after the CLI path is solid. Biggest hidden cost: Docker Postgres doesn't belong in a double-click app — consider pglite/embedded Postgres before committing. |
| **CLI launcher / doctor** (`npx job-os` or `npm run doctor` + `npm run up`) | One command: check Node/Docker/ports → start DB → migrate deploy → seed if empty → start server → open browser | One command, clear failures with fixes printed | Cheapest by far; pure TypeScript, reuses existing scripts | Little; each check is independent | Low | **Best next step. Do this first.** It also becomes the sidecar logic the desktop app calls later. |
| **Script installer** (`curl \| sh` or `install.sh`) | Shell script performing the same steps | OK once; opaque when it fails; platform-specific | Bash maintenance, poor error reporting | Anything OS-specific | Medium | Avoid — the CLI launcher does the same job in the language the repo already uses. |
| **Package manager** (Homebrew) | Formula wrapping the CLI launcher | Nice for devs (`brew install job-os`) | Formula upkeep per release | Node/Docker deps outside brew's control | Medium | Optional later, thin wrapper over the CLI. Not before v1. |
| **Background service** (launchd/systemd for server + scheduler) | Server and catchup always running | App "just is there" at localhost | Already half-built (`lib/scheduler/launchd.ts`) but buggy (§4.3) and macOS-only | Silent failures, log dir bug, no Linux/Windows story | Medium | Right for the **scheduler only**, not the web server. Fix the log-dir bug; better: run the scheduler inside the Next server process (setInterval/cron in `instrumentation.ts`) so no OS service is needed at all. |
| **Self-update flow** | `job-os update`: git pull/download → `migrate deploy` → restart | Removes the scariest lifecycle step | Small once CLI exists | Schema drift if migrations fail mid-way (backup-first mitigates — you already have encrypted backups) | Low-Medium | Yes, as a CLI subcommand. Auto-update (Tauri updater) only after desktop is real. |

**Recommended lifecycle architecture:** one TypeScript CLI (`job-os doctor | up | update | backup`) as the single source of truth; the in-process scheduler replaces launchd for the common case; the Tauri app becomes a thin shell that invokes the same CLI logic. This gives one code path to maintain across web, LAN, and desktop.

---

## 8. Prioritized improvement plan

Ordered for execution. Complexity: S (<½ day), M (1–2 days), L (3+ days).

| # | Change | Why | Benefit | Cx | Risks / trade-offs |
|---|---|---|---|---|---|
| 1 | Rotate `.env` secrets; placeholders only | Live keys on disk / exposed in review | Removes standing exposure | S | None |
| 2 | Shared `fetchWithTimeout` (generalize `safeFetch`) across all job sources, `chat()`, `embedText()`; make `chat()` degrade gracefully like `embedText()` | Any hung vendor freezes discovery/autopilot; raw provider errors reach UI | No more indefinite hangs; clean user-facing errors | S–M | Choose sane defaults (10–15s); a slow-but-working vendor may get cut off |
| 3 | Configure pg Pool (max, timeouts, statement_timeout) + `pool.on('error')`; connect timeout on `pingDatabase` | Postgres restart can crash Node; health check can hang | Server survives DB bounces | S | None meaningful |
| 4 | Fix `run-job.ts` to record real `syncInbox` status; add failure backoff to watermarks; persist autopilot last-run to DB instead of module variable | Failures recorded as success; scheduled runs invisible in UI | Honest run history, visible outages | S | Watermark semantics need care (don't re-run forever on permanent failure) |
| 5 | Atomic `saveKeys` (temp-write + rename + in-process mutex) | Lost-update race, truncation on crash | Secrets can't be silently dropped | S | None |
| 6 | `job-os doctor` + `job-os up` CLI: check Node ≥22 (add `engines` + `.nvmrc`), Docker running, ports 3000/5432 free → db up → `migrate deploy` → seed-if-empty → start → open browser. Unify all docs and `db-banner.tsx` on `migrate deploy` | 7-step install, contradictory migration commands, no preflight | Install drops to 2 commands; failures print fixes | M | Keep it dependency-light; must work cross-platform |
| 7 | Per-integration key validation ("Test" button probing each provider; distinguish invalid-key from empty results in job sources) | Wrong keys look valid; empty results ambiguous | Trustworthy setup; the #1 UX confidence fix | M | Each provider needs a cheap probe endpoint; probes cost tiny API spend |
| 8 | De-jargon the UI: rewrite driver/armed/fixture/adapter/Postgres/launchd/npm strings; plain-language DbBanner with an "Advanced" expander for commands; title-case "Autonomous" | Product reads as a developer tool on every primary screen | Single biggest perceived-polish win | M | Keep an Advanced/developer mode so power users lose nothing |
| 9 | Explicit Demo mode instead of silent fixture fallback (banner + one-click "Exit demo"); hide non-live modules from nav by default; fold Modules into Setup stage; de-dup Outcomes | Fake data erodes trust; 19-item nav with half non-live | Clear first-run story; focused navigation | M | Demo mode needs a deliberate entry point for showcasing |
| 10 | In-process scheduler (cron loop started from `instrumentation.ts`, advisory lock to prevent overlap) replacing launchd for the default case; fix `.logs/` creation for those who still use launchd | Recurring jobs effectively don't run for real users; launchd agents fail silently; no overlap guard | Autopilot/backup actually happen; cross-platform | M | Only runs while server runs — acceptable for a local app; keep launchd as an option |
| 11 | `job-os update` subcommand: backup → pull/download → `migrate deploy` → restart. Single version source (read package.json everywhere) | No update story; schema drift risk | Safe, one-command updates | M | Migration failure mid-update — mitigated by the automatic pre-update backup you already have |
| 12 | Job staleness: age indicator on rows, auto-archive after N days, optional URL re-check | Queue silently accumulates dead listings | Data freshness users can trust | M | Aggressive pruning may hide jobs users wanted; make threshold configurable |
| 13 | Accessibility pass: text alternatives for color-only status, skip-to-content link, focus trap in mobile drawer; unify color-token usage | Sampled gaps in an otherwise good baseline | Professional-grade a11y | S–M | None |
| 14 | Fix or park Tauri: correct `frontendDist`/standalone path to `.next-build`, bundle Node via `externalBin` (or embed via sidecar binary), log sidecar stderr to a file, dynamic port, run `migrate deploy` on boot. Decide on embedded Postgres (pglite) vs Docker for desktop | Primary-target build cannot start; Docker is a bad desktop dependency | A desktop app that actually launches | L | Largest item; signing/notarization and DB embedding are real projects. Reasonable to defer behind items 1–13 |
| 15 | Test consolidation: one `test:all` runner (then migrate the 35 scripts toward vitest incrementally); delete `supervisor-loop.sh`, stray root `tsbuildinfo` files, unify on one distDir | 35 unaggregated bespoke scripts; repo debris causes the documented blank-screen bug | Sustainable long-term maintenance | M (incremental) | Migration churn; do it gradually |

**Order rationale:** 1–5 are safety/correctness fixes with near-zero risk (do this week). 6–7 fix install and trust. 8–9 deliver the perceived-polish jump. 10–12 make the app self-sustaining. 13 rounds out quality. 14 (desktop) is deliberately late: it's the most expensive item and everything before it (CLI, scheduler, de-jargoned UI, key validation) is exactly what the desktop shell needs underneath it anyway. 15 runs continuously in the background.

---

## 9. What NOT to do

- Don't add new features (more modules, more integrations) before the shell is fixed — the nav already advertises incompleteness.
- Don't build a bash installer or Homebrew formula before the TypeScript CLI exists.
- Don't ship the Tauri app with Docker-Postgres as a hidden dependency.
- Don't keep the silent fixture fallback; make demo mode explicit.
