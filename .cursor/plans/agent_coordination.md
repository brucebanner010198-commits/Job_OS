# Agent Coordination Manifest

**Last updated:** 2026-06-18 (orchestrator cycle 3)  
**Monitor:** Full-Stack Orchestrator (this session)  
**Git:** ❌ **Not initialized** — recommend `git init` before further parallel agents.  
**Build:** ✅ `npm run typecheck` **0 errors** | ✅ `npm run build` **PASS** | ✅ core test matrix **green**

---

## Orchestrator cycle 3 log (2026-06-18)

| Step | Result |
|------|--------|
| Polled `review_backend_report.md` | ✅ Complete |
| Polled `review_frontend_report.md` | ✅ Complete (arrived mid-cycle) |
| `npm run typecheck` | ✅ 0 errors |
| Core tests (integrations, security, autopilot, apply, apply-state, profiles, voice, knowledge, jobs, brief, interview, track) | ✅ All pass |
| Extended CI subset (provenance, goals, scoring, warm, followup, backup, outcomes, brief-web-research) | ✅ All pass |
| `npm run build` | ✅ PASS (after `/import` force-dynamic fix) |
| `review_fullstack_status.md` | ✅ Written |

**Fixes applied (orchestrator):**
- `app/(app)/import/page.tsx` — `export const dynamic = "force-dynamic"` (prerender crash)

**Verified fixed (parallel agents during cycle):**
- Profile switcher in `app-shell.tsx`
- `PipelineRail` + `SettingsToolsPanel` UX consolidation partial
- `listChunks` profile isolation (SEC-06)
- Track board ActionFeedback (FE-005)
- Jobs queue ATS panel + `resumeText` wiring

**Still deferred:** UX nav collapse, Gmail OAuth state, autopilot brief wiring, git init, DB migrate verification by user.

---

## File ownership table

| Path / glob | Owning agent | Status | Notes |
|-------------|--------------|--------|-------|
| `package.json`, `package-lock.json` | `486902b2` dependency audit | **done** | Released 01:16 UTC; health may add test scripts only via queue |
| `components/theme-*` | `67fc2ecd` theme | **done** | Released |
| `.cursor/plans/competitive_*.md` | `8762ca7a` research | **done** | Plans only |
| `.cursor/plans/job_os_master_execution_plan.md` §13 rows | `49f52b76` judgment, `e8d0f16f` backlog merge | **done** | Append-only; released for reads |
| `lib/integrations/**`, `app/(app)/integrations/**`, `lib/secrets/**` (feature) | `47537298` master plan Phases 1–6 | **done** | Released; security reviews after |
| `lib/jobs/sources/*`, `lib/knowledge/**`, `lib/voice/**`, `lib/autopilot/**` | `47537298` master plan | **done** | Released |
| `prisma/schema.prisma`, `prisma/migrations/20260618120000_multi_profile/**` | `077d2f05` multi-user profiles | **active** | Profile model + `profileId` on entities landed 01:20 UTC |
| `lib/profiles/**`, `lib/app-context.ts` | `077d2f05` profiles | **active** | CRUD + cookie scope done 01:18 UTC |
| `lib/**/service.ts`, `lib/apply/**`, `lib/scoring/**`, `lib/knowledge/**` (AppScope) | `545eee6f` profiles subagent (scope migration) | **done** | AppScope migration complete; typecheck green cycle 2 |
| `app/actions/*.ts`, `app/(app)/**/page.tsx`, `app/api/**` (getAppContext) | `545eee6f` profiles subagent | **done** | Released cycle 2 |
| `components/app-shell.tsx` | **shared** — theme done, profiles switcher pending | **released** (nav) | Integrations `Plug` nav merged additively; profile switcher slot reserved |
| `app/(app)/page.tsx` | `47537298` + profiles scope | **released** | Scope fix landed; typecheck green |
| `scripts/test-security.ts`, `lib/security/**` | `f2fb7923` security red-team | **active** | File created 01:28 UTC; transcript stalled — treat as in-flight |
| `lib/apply/service.ts` Phase 5 features | `47537298` + `68274b3e` queue | **released** (features) | Serialize fixes with health coordinator |
| `.cursor/plans/agent_coordination.md` | collision monitor | **active** | This file |

---

## Conflict zones

| Hot file | Agents at risk | Current lock | Last mtime (local) |
|----------|----------------|--------------|-------------------|
| `prisma/schema.prisma` | profiles, master plan, health | **LOCKED → profiles** | 2026-06-18 01:20:16 |
| `package.json` | dep audit, health, security | **released** | 2026-06-18 01:16:16 |
| `lib/modules.ts` | master plan, integrations | **released** | 2026-06-18 01:10:50 |
| `components/app-shell.tsx` | theme, profiles switcher, integrations nav | **released** (additive) | 2026-06-18 01:11:05 |
| `app/(app)/page.tsx` | master plan dashboard, profiles scope | **released** | 2026-06-18 01:24:25 |
| `lib/apply/service.ts` | master plan P5, profiles AppScope, health | **released** | 2026-06-18 01:23:34 |
| `job_os_master_execution_plan.md` | master plan, backlog, judgment, research | **released** (append-only) | 2026-06-18 01:25:20 |

---

## Sequencing rules

1. **Profiles migration before queries** — `prisma migrate deploy` + `db:generate` after schema stable; all services must use `AppScope` before new features on same files.
2. **`prisma/schema.prisma`** — profiles agent owns; others request columns via manifest, do not edit.
3. **`package.json`** — serialize: dep audit → health (test scripts) → security (audit deps). No parallel edits.
4. **`lib/apply/**`** — master plan features landed; health coordinator fixes after profiles scope batch **releases lock**.
5. **`lib/secrets/**` + integrations** — feature work done; security red-team **reviews after** profiles + typecheck green (no feature rewrites during review).
6. **`components/app-shell.tsx`** — merge additive only (theme toggle ✓, Integrations nav ✓, profile switcher next).
7. **Master plan markdown** — append sections only; never delete others' rows.
8. **Priority on contradiction:** security fix > bug fix > feature > plan doc.

---

## Agent queue (shared files)

| Order | Agent | ID | Wait for | Next action |
|-------|-------|-----|----------|-------------|
| 1 | Health coordinator | `68274b3e` | — | `npm run db:migrate`, run full CI test matrix, confirm migrations applied |
| 2 | Profiles parent (UI) | `077d2f05` | health db:migrate | Profile switcher in `app-shell.tsx`, settings/create/delete UI |
| 3 | Security red-team | `f2fb7923` | health tests baseline | Complete assessment, `test:security`, §14 plan append |
| ~~1~~ | ~~Profiles AppScope subagent~~ | `545eee6f` | — | ✅ **Complete** (typecheck 0) |
| 5 | Master plan | `47537298` | — | **PAUSE** — session complete; resume only for P5 PDF attach if queued |

---

## Agent status (transcript health)

| Agent | ID | Transcript lines | Status | Recommendation |
|-------|-----|------------------|--------|----------------|
| Master execution Phases 1–6 | `47537298` | 69 | ✅ **done** | **Pause** — report delivered; typecheck drift expected until profiles finishes |
| Health coordinator | `68274b3e` | 1 | ⏸ **stalled** | **Resume immediately** after scope lock releases |
| Multi-user profiles (parent) | `077d2f05` | 1 | ⏸ **stalled** | **Resume** for UI switcher after backend scope green |
| Profiles AppScope subagent | `545eee6f` | 2+ | ✅ **done** (transcript short; work landed) | **Pause** — scope migration complete |
| Security red-team | `f2fb7923` | 1 | ⏸ transcript stalled; file activity | **Pause new file edits** until typecheck green; may finish read-only assessment |
| Backlog merge | `e8d0f16f` | 8 | ✅ **done** | Pause |
| Theme | `67fc2ecd` | 12 | ✅ **done** | Pause |
| Dependency audit | `486902b2` | 22 | ✅ **done** | Pause |
| Competitive research | `8762ca7a` | 12 | ✅ **done** | Pause |
| Judgment §13 | `49f52b76` | 11 | ✅ **done** | Pause |

---

## Collision log

| Timestamp (UTC) | Files | Agents | Detection | Resolution |
|-----------------|-------|--------|-----------|------------|
| 2026-06-18 05:28 | `lib/apply/*`, `lib/interview/service.ts`, `lib/knowledge/index.ts`, `app/actions/*` | `47537298` + `545eee6f` | Edits within 3 min window (01:23–01:26 local); signature migration mid-flight | **No revert.** Changes additive (features + `AppScope`). `interview/service.ts` `userId` leftover self-corrected during monitoring. Lock scope batch until complete. |
| 2026-06-18 05:28 | `app/(app)/page.tsx` | `47537298` + profiles | Dashboard widget calls still pass `userId` string | **LOCKED** — assign to profiles subagent / health |
| 2026-06-18 05:28 | `scripts/test-security.ts` | `f2fb7923` + profiles | Security test references `scopeWhere` while profiles migration active | **No merge conflict.** TS2367 literal comparison — health/security fix after lock release |
| 2026-06-18 05:28 | `prisma/schema.prisma` | profiles + master plan | Schema edited 01:20; master plan reported blocked on migration | **Exclusive ownership** profiles; master plan did not re-edit — OK |
| 2026-06-18 05:29 | scope batch (lib + actions) | `545eee6f` | 58 → 0 typecheck errors between cycles | **Resolved without manual merge** — migration completed in parallel |

---

## Logo consistency pass (agent — brand assets, 2026-06-18)

**Scope:** Read-only audit + docs (`brand_logo*.md`) and code edits **only** to exclusively-owned logo files.

| Path | Owner | Status | Notes |
|------|-------|--------|-------|
| `components/brand/job-os-logo.tsx` | logo-consistency | **edited** | Icon variant inlined so `currentColor` actually applies (was broken via `<img>`); design unchanged. Typecheck green. |
| `public/brand/logo-icon.svg` | logo-consistency | **edited** | Cosmetic: fixed corrupted comment bytes. No geometry/color change. |
| `.cursor/plans/brand_logo*.md` | logo-consistency | **active** | 3 docs (report, guidelines, deployment checklist). |
| `app/layout.tsx` (metadata.icons), `components/app-shell.tsx`, `app/globals.css` | **shared — held by `9399791d`** | **DEFERRED** | Logo fixes documented in `brand_logo_deployment_checklist.md` for serialized apply. Did NOT edit. |
| `src-tauri/tauri.conf.json` (`bundle.icon`) | unassigned | **DEFERRED** | Add icon array only after `src-tauri/icons/*` generated, else `tauri build` breaks. Documented. |

**Collision avoidance:** No edits to `app-shell.tsx` / `layout.tsx` / `globals.css` (active under `9399791d`). All required changes to those files are written as explicit, ready-to-apply steps in the deployment checklist.

---

## Current file locks

| Lock | Paths | Holder | Release when |
|------|-------|--------|--------------|
| 🔒 **LOCKED** | `prisma/schema.prisma` | `077d2f05` | `db:migrate` applied + verified |
| ⏸ **HOLD** (lifted) | `lib/secrets/**` (security fixes) | `f2fb7923` | typecheck green — security may proceed |
| ✅ **RELEASED** | All lib services, app/actions, app pages, `package.json`, theme, integrations | — | Cycle 2 |

---

## Build health snapshot (cycle 3)

```
npm run typecheck → 0 errors ✅
npm run build → PASS ✅
Core + extended CI test matrix → green ✅
```

**Deliverable:** `.cursor/plans/review_fullstack_status.md` — complete.

**User action:** `git init`, `npm run db:migrate`, configure API keys at `/integrations`.

---

## Recommendations (pause / resume)

| Agent | Action |
|-------|--------|
| Full-Stack Orchestrator | **Pause** — cycle 3 complete; green gates |
| `68274b3e` (health) | **Pause** — tests verified by orchestrator |
| `077d2f05` (profiles UI) | **Pause** — switcher shipped |
| `f2fb7923` (security) | **Resume** — P0: Gmail OAuth state, read-action gates |
| All DONE agents | **Pause** |

**User action:** Run `git init && git add -A && git commit -m "Job OS checkpoint — orchestrator cycle 3 green"`.

---

## Pending for health coordinator

1. ~~Run full CI matrix~~ ✅ **done** (orchestrator cycle 3).
2. User: `npm run db:up && npm run db:generate && npm run db:migrate`.
3. P0 security: SEC-08 Gmail OAuth signed state.
4. UX: collapse legacy 16-item nav (`ux-pipeline-shell`).
5. Autopilot: wire `ensureBrief` into `runAutopilotCycle`.

---

*Cycle 3 complete — see `review_fullstack_status.md`.*

---

## BUILD/DEV CACHE rule (2026-06-18, dev-server-500 remediation)

**Why:** Recurring dev-server HTTP 500s were caused by `npm run build` (and stray `rm -rf .next`) running while a `next dev` server was live, both sharing the `.next` cache. Code/typecheck/build/tests were green; this was pure build-vs-dev cache contention, worsened by leftover supervisor while-loops and duplicate `npx next dev` instances.

**Durable guard (landed):** Production builds now write to a SEPARATE dir.

| File | Change |
|------|--------|
| `next.config.ts` | Conditional `distDir`: `.next-build` when `NODE_ENV=production` or `BUILD=1`, else `.next` |
| `package.json` | `build` -> `BUILD=1 next build`, `start` -> `BUILD=1 next start` |
| `scripts/build-standalone.sh` | Stages from `.next-build/standalone` + `.next-build/static` |
| `.gitignore` | Added `/.next-build/` |

**Rules for ALL agents:**
1. `npm run build` / `build:standalone` write to `.next-build`. Dev uses `.next`. Building while dev runs is now SAFE.
2. NEVER `rm -rf .next` while a `next dev` server is live. Stop dev first, or clear `.next-build` only.
3. ONE dev server, ONE port (prefer 3000). No duplicate `npx next dev`, no background watchdog loops that `kill next dev; rm -rf .next; npm run dev`.

**Verified:** dev on 3000 held HTTP 200 through a concurrent `npm run build` (exit 0 to `.next-build`); `npm run typecheck` 0 errors. Full detail in `ui_blank_screen_fix.md` (BUILD/DEV CACHE section).
