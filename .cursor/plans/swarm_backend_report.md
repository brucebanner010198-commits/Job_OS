# Swarm Backend Report

- **Timestamp:** 2026-06-18
- **Agent:** swarm-backend-fixes
- **Repo:** `/Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS`
- **Inputs:** `review_backend_report.md`, master plan Phases 1–6 / §13–16

---

## Executive summary

All requested backend fixes are applied. `npm run typecheck` passes and the full backend test matrix is green. The autopilot chain now runs **discover → index → brief → prepare → auto-submit (AUTONOMOUS only)**; catchup `discover-jobs` uses goal-aware queries; Gmail OAuth uses signed per-profile CSRF state; Playwright can attach a resume PDF when configured.

---

## Fixes applied

| # | Item | Status | Files |
|---|------|--------|-------|
| 1 | Autopilot `ensureBrief` before prepare | **done** | `lib/brief/service.ts`, `lib/autopilot/orchestrator.ts` |
| 2 | Gmail OAuth per-profile state (SEC-08) | **done** | `lib/gmail/oauth-state.ts`, `app/api/gmail/auth/route.ts`, `app/api/gmail/callback/route.ts`, `lib/gmail/token-store.ts`, `lib/gmail/index.ts`, `lib/gmail/source-live.ts`, `lib/track/service.ts`, `app/(app)/track/page.tsx` |
| 3 | Failing backend tests | **none found** — all matrix scripts pass | — |
| 4 | `lib/track/rejection-learning.ts` | **verified complete** (competitor agent landed extended module with `explainRejection`, coach notes, failure modes) | `lib/track/rejection-learning.ts` |
| 5 | Goal-aware discovery in catchup | **done** | `scripts/run-catchup.ts` — `discover-jobs` uses `discoveryQueryForUser(scope)` |
| 6 | Resume PDF attach in driver (Phase 5) | **done** | `lib/apply/resume-pdf.ts`, `lib/apply/types.ts`, `lib/apply/driver-playwright.ts`, `lib/apply/driver-simulated.ts`, `lib/apply/service.ts` |

### Detail

**BE-AUTO-01 / ux-orchestrator-brief:** `ensureBrief()` returns latest brief or generates one. `runAutopilotCycle` calls it for each top-N job before `prepareApplication`, tracking `briefed` count in results and catchup watermark detail.

**SEC-08:** Auth route creates HMAC-signed random `state` bound to `scope.profileId`, stores in httpOnly cookie, callback verifies cookie + signature before token exchange. Tokens persist per profile at `.secrets/gmail-{profileId}.json` (legacy `.secrets/gmail.json` fallback).

**Phase 5 resume attach:** `resolveResumePdfPath()` reads `APPLY_RESUME_PDF` or `.secrets/resume.pdf`. `approveAndSubmit` calls optional `driver.attachResume()` after fill. Playwright locates file inputs (`resume`/`cv`/pdf accept) and uses `setInputFiles`.

---

## Test matrix (all pass)

| Command | Result | Pass / Total |
|---------|--------|--------------|
| `npm run typecheck` | **PASS** | 0 errors |
| `npm run test:integrations` | **PASS** | 9/9 |
| `npm run test:security` | **PASS** | 22/22 |
| `npm run test:autopilot` | **PASS** | 10/10 |
| `npm run test:knowledge` | **PASS** | 2/2 |
| `npm run test:jobs` | **PASS** | 34/34 |
| `npm run test:brief` | **PASS** | 28/28 |
| `npm run test:profiles` | **PASS** | 8/8 |
| `npm run test:track` | **PASS** | 69/69 |
| `npm run test:apply` | **PASS** | 58/58 |
| `npm run test:apply-driver` | **PASS** | 23/23 |
| `npm run test:apply-state` | **PASS** | 45/45 |
| `npm run test:interview` | **PASS** | 50/50 |
| `npm run test:voice` | **PASS** | 13/13 |
| `npm run test:brief-web-research` | **PASS** | 5/5 |
| `npm run test:competitor-fixes` | **PASS** | 13/13 |

**New/extended test coverage this session:**
- `test:autopilot` — orchestrator chain + OAuth state verification
- `test:apply-driver` — `attachResume()` seam test

---

## Still deferred (from review, out of scope)

- SEC-01 read-only server action gating on LAN
- CI expansion (`test:security`, `npm audit`, etc.)
- Knowledge Notebook DB integration tests
- End-to-end `runAutopilotCycle` integration test (requires live DB)
- Native PDF generation (user still prints HTML → PDF; driver accepts pre-built PDF via `APPLY_RESUME_PDF`)

---

## Usage notes

```bash
# Autopilot catchup (brief → prepare → AUTONOMOUS submit)
AUTOPILOT_ENABLED=1 npm run catchup

# Resume PDF for Playwright apply
cp ~/Downloads/resume.pdf .secrets/resume.pdf
# or: APPLY_RESUME_PDF=/path/to/resume.pdf

# Gmail connect — state cookie + per-profile token file
open http://localhost:3000/api/gmail/auth
```
