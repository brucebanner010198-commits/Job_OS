# Backend Review Report

- **Timestamp:** 2026-06-18 (backend-review agent)
- **Reviewer agent ID:** `backend-review`
- **Repo:** `/Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS`
- **Coordination:** Read `job_os_master_execution_plan.md` (Phases 1–6, §13–15) and `agent_coordination.md`

---

## Executive summary

Backend is **largely healthy**: `npm run typecheck` passes, and all requested test scripts pass. Multi-profile `AppScope` migration is landed in schema/migrations and wired through core services. Secrets flow through `getSecret()` / composite store; SSRF and Playwright URL guards are in place; mutation server actions are gated via `requireAccessForMutation()` when `JOB_OS_ACCESS_TOKEN` is set on non-loopback hosts.

**Remaining risks (deferred):** Gmail OAuth uses a static `state=track` (CSRF); read-only server actions (`listProfilesAction`, `getActiveProfileAction`, `listIntegrationsAction`) are ungated on LAN; CI omits `test:security`, `test:autopilot`, `test:knowledge`, `test:profiles`, `test:apply-driver`, `test:interview`, `test:voice`, and `test:apply-state`; Knowledge Notebook tests are unit-only (no DB/RAG integration); autopilot orchestrator does not call `ensureBrief` before prepare.

**Fix applied this session:** `listChunks` now filters by both `userId` and `profileId` (SEC-06 defense-in-depth).

---

## Test matrix (pass/fail counts)

| Command | Result | Pass / Total |
|---------|--------|--------------|
| `npm run typecheck` | **PASS** | 0 errors |
| `npm run test:integrations` | **PASS** | 9/9 |
| `npm run test:security` | **PASS** | 18/18 |
| `npm run test:autopilot` | **PASS** | 7/7 |
| `npm run test:knowledge` | **PASS** | 2/2 |
| `npm run test:jobs` | **PASS** | 34/34 |
| `npm run test:brief` | **PASS** | 28/28 |
| `npm run test:profiles` | **PASS** | 8/8 |
| `npm run test:track` | **PASS** | 69/69 |
| `npm run test:apply` | **PASS** | 58/58 |
| `npm run test:apply-driver` | **PASS** | 22/22 |
| `npx tsx scripts/test-apply-state.ts` | **PASS** | 45/45 |
| `npm run test:interview` | **PASS** | 50/50 |
| `npm run test:voice` | **PASS** | 13/13 |
| `npm run test:brief-web-research` | **PASS** | 5/5 |

**Note:** `test:apply-state` exists at `scripts/test-apply-state.ts` but is **not wired** in `package.json` (user request referenced `npm run test:apply-state` — script missing from npm scripts).

**CI gap:** `.github/workflows/ci.yml` runs a subset only (typecheck, integrations, provenance, goals, scoring, jobs, brief, apply, track, warm, followup, backup, outcomes). Does **not** run security, autopilot, knowledge, profiles, apply-driver, interview, voice, or apply-state.

---

## Module-by-module status table

| Module | Key paths | Status | Tests |
|--------|-----------|--------|-------|
| **Prisma / migrations** | `prisma/schema.prisma`, `migrations/20260618120000_multi_profile`, `20260618130000_apply_state_paused_handoff`, `20260617120000_pgvector_embeddings` | **working** — Profile model + `profileId` on entities; `PAUSED`/`HANDOFF` apply states | `test:profiles` (8/8) |
| **App context / scope** | `lib/app-context.ts`, `lib/profiles/scope.ts` | **working** — cookie-based active profile; `scopeWhere` / `scopeData` | `test:security` scope checks |
| **Secrets** | `lib/secrets/index.ts`, `composite.ts`, `file-store.ts`, `keychain.ts`, `desktop-install.ts`, `sync.ts` | **working** — portal file → env; desktop keychain optional | `test:integrations` (9/9) |
| **Integrations registry** | `lib/integrations/registry.ts`, `app/actions/integrations.ts`, `app/api/integrations/status/route.ts` | **working** — status API never leaks values | `test:integrations`, `test:security` |
| **Jobs pipeline** | `lib/jobs/service.ts`, `pipeline.ts`, `sources/*` | **working** — Remotive + RemoteOK + Arbeitnow + Jobicy + JSearch + fixtures | `test:jobs` (34/34) |
| **Scoring** | `lib/scoring/score.ts`, `embedding-relevance.ts`, `hard-gate.ts` | **working** | `test:scoring` (CI, not re-run here) |
| **Brief** | `lib/brief/service.ts`, `sources.ts`, `source-web-research.ts`, `source-edgar.ts`, `compose.ts` | **working** — Crunchbase removed from default pipeline; web-research + EDGAR adapters present | `test:brief` (28/28), `test:brief-web-research` (5/5) |
| **Knowledge notebook** | `lib/knowledge/index.ts`, `retrieve.ts` | **partial** — AppScope-scoped index/retrieve; `KnowledgeChunk` via raw SQL (not Prisma model); embeddings keyed `userId` + `profileId:cacheKey` | `test:knowledge` (2/2 unit only) |
| **Apply brain** | `lib/apply/engine.ts`, `router.ts`, `state-machine.ts`, `service.ts` | **working** — REVIEW gate, AUTONOMOUS/ASSISTED/MANUAL routing | `test:apply` (58/58), `test:apply-state` (45/45) |
| **Apply driver** | `lib/apply/driver-playwright.ts`, `driver.ts`, `session-service.ts` | **partial** — Playwright opt-in; in-memory session store (not durable); URL guard present | `test:apply-driver` (22/22) |
| **Apply fields LLM** | `lib/apply/fields-llm.ts` | **working** — grounded via knowledge retrieve | No dedicated test |
| **Autopilot** | `lib/autopilot/orchestrator.ts`, `policy.ts` | **partial** — policy correct; orchestrator chains discover→index→prepare→submit but **skips brief generation** | `test:autopilot` (7/7 policy only) |
| **Gmail** | `lib/gmail/oauth.ts`, `token-store.ts`, `source-live.ts` | **partial** — `getSecret()` for OAuth config; static OAuth state | `test:track` (indirect) |
| **Track** | `lib/track/service.ts`, `proposals.ts`, `sync.ts` | **working** — propose-only Gmail moves | `test:track` (69/69) |
| **Interview** | `lib/interview/service.ts`, `study.ts`, `voice-live.ts`, `index.ts` | **working** — `loadFacts(scope)` profile-scoped; sensitive filtering | `test:interview` (50/50), `test:voice` (13/13) |
| **Profiles** | `lib/profiles/service.ts` | **working** — CRUD + isolation markers | `test:profiles` (8/8) |
| **Scheduler** | `lib/scheduler/service.ts`, `scripts/run-catchup.ts` | **partial** — 3 job kinds; autopilot cycle hook exists | Not in requested matrix |
| **Auth / middleware** | `middleware.ts`, `lib/auth/access.ts`, `require-access.ts` | **working** — API prefixes gated; timing-safe compare; null-Host fix | `test:security` (18/18) |
| **Security** | `lib/security/url.ts`, `lib/brief/fetch-utils.ts` | **working** — SSRF + apply URL guards | `test:security` |
| **Backup API** | `app/api/backup/export/route.ts` | **partial** — scoped export; ungated when `JOB_OS_ACCESS_TOKEN` unset | `test:backup` (CI only) |
| **Server actions** | `app/actions/**` | **partial** — all **mutations** gated; 3 **read** actions ungated | Per-action |
| **API routes** | `app/api/**` | **working** — apply session uses `getAppContext().scope` | Indirect |

---

## Issues

| ID | Severity | File(s) | Description | Fix status |
|----|----------|---------|-------------|------------|
| BE-SEC-01 | **High** (was Critical) | `app/actions/profiles.ts`, `app/actions/integrations.ts` | Read-only server actions (`listProfilesAction`, `getActiveProfileAction`, `listIntegrationsAction`) lack `requireAccessForMutation()` — LAN exposure without token can leak profile list / integration status | **deferred** |
| BE-SEC-06 | **High** | `lib/knowledge/index.ts` | `listChunks` previously filtered `profileId` only | **fixed** — now `userId` + `profileId` |
| BE-SEC-06b | Medium | `lib/knowledge/index.ts`, `prisma/schema.prisma` | `KnowledgeChunk` table created via raw SQL, not Prisma model — no FK/migration discipline | **deferred** |
| BE-SEC-07 | High | `lib/interview/service.ts` | `loadFacts` cross-profile bleed | **fixed** (prior pass) — uses `scopeWhere(scope)` |
| BE-SEC-08 | Medium | `app/api/gmail/auth/route.ts`, `callback/route.ts` | OAuth `state` hardcoded `"track"`; callback does not verify state | **deferred** |
| BE-SEC-10 | Medium | `lib/auth/access.ts` | `?token=` query param accepted (referrer/log leak risk) | **deferred** |
| BE-SEC-11 | Medium | `app/api/backup/export/route.ts` | Full profile export when `JOB_OS_ACCESS_TOKEN` unset on LAN | **deferred** (middleware covers when token set) |
| BE-SEC-12 | Medium | `app/api/apply/session/[id]/route.ts` | Session API scope mismatch | **fixed** (prior pass) — uses `getAppContext().scope` |
| BE-CI-01 | Medium | `.github/workflows/ci.yml` | Missing `test:security`, `test:autopilot`, `test:knowledge`, `test:profiles`, `test:apply-driver`, `test:interview`, `test:voice`; no `npm audit` | **deferred** |
| BE-TEST-01 | Low | `package.json` | `scripts/test-apply-state.ts` exists but no `test:apply-state` npm script | **deferred** |
| BE-TEST-02 | Medium | `scripts/test-knowledge.ts` | Only tests `cosineSimilarity` + chunk shape — no DB index/retrieve integration | **deferred** |
| BE-TEST-03 | Medium | `scripts/test-autopilot.ts` | Policy + query fallback only — no end-to-end `runAutopilotCycle` test | **deferred** |
| BE-AUTO-01 | Medium | `lib/autopilot/orchestrator.ts` | `runAutopilotCycle` does not call `ensureBrief` / `generateBrief` before prepare (master plan §15 `ux-orchestrator-brief`) | **deferred** |
| BE-APPLY-01 | Low | `lib/apply/session-service.ts` | In-memory `Map` — sessions lost on restart; no Playwright browser binding yet | **deferred** (Phase 5 scope) |
| BE-DEPS-01 | Low | `package.json` | 2 moderate npm advisories (`next`, `postcss`) per security assessment | **deferred** |
| BE-GIT-01 | Info | repo root | Git not initialized per `agent_coordination.md` — no VCS collision detection | **deferred** (user action) |

---

## Fixes applied this session

1. **`lib/knowledge/index.ts`** — `listChunks` SQL now filters `WHERE "userId" = $1 AND "profileId" = $2` (SEC-06 defense-in-depth).

Prior agents already landed (verified, not re-edited):

- SEC-01 mutation gates on `app/actions/*` (except read-only profile/integration list actions)
- SEC-02/05 middleware + protected API prefixes
- SEC-03/04 SSRF + Playwright URL guards
- SEC-07 interview `loadFacts(scope)`
- SEC-12 apply session `getAppContext().scope`
- Multi-profile Prisma migration + AppScope service migration

---

## Deferred items for orchestrator

1. **Wire `test:apply-state`** into `package.json` and CI.
2. **Expand CI matrix** — at minimum `test:security`, `test:profiles`, `test:apply-driver`, `test:autopilot`, `test:knowledge`; add `npm audit --audit-level=high`.
3. **SEC-08** — signed/random OAuth state cookie on Gmail connect.
4. **SEC-01 completion** — gate read-only server actions that return user data, or document intentional localhost-trust model.
5. **Knowledge Notebook** — promote `KnowledgeChunk` to Prisma model; add integration tests for `indexUserKnowledge` + `retrieveKnowledge`.
6. **Autopilot** — wire `ensureBrief` into `runAutopilotCycle`; add orchestrator integration test.
7. **Health coordinator** — confirm `npm run db:migrate` applied for `20260618120000_multi_profile` and `20260618130000_apply_state_paused_handoff`.
8. **`git init`** — enable diff-based agent collision detection.

---

## Raw commands run

```bash
cd /Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS

npm run typecheck
npm run test:integrations
npm run test:security
npm run test:autopilot
npm run test:knowledge
npm run test:jobs
npm run test:brief
npm run test:profiles
npm run test:track
npm run test:apply
npm run test:apply-driver
npx tsx scripts/test-apply-state.ts
npm run test:interview
npm run test:voice
npm run test:brief-web-research

# Re-run after fix:
npm run typecheck
npm run test:security
npm run test:knowledge
```
