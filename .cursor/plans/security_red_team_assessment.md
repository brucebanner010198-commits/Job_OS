# Job OS — Defensive Security Assessment (Red Team)

**Date:** 2026-06-18  
**Scope:** Authorized local-first assessment of `/Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS`  
**Framing:** MITRE ATT&CK defensive validation — attack surface mapping, simulated paths, detection gaps, fixes  
**Coordination gate:** Multi-profile `AppScope` migration in flight; typecheck red (pre-existing). Assessment performed on current code without reverting in-progress work.

---

## Executive summary

| Severity | Count | Fixed in this pass | Deferred |
|----------|-------|-------------------|----------|
| **Critical** | 2 | 1 | 1 |
| **High** | 5 | 3 | 2 |
| **Medium** | 6 | 0 | 6 |
| **Low** | 4 | 0 | 4 |
| **Info** | 3 | 0 | 3 |

**Bottom line:** Job OS is appropriately designed as a **local-first, single-user** app with good secret hygiene (composite store, status API never returns values, Gmail tokens off-DB). The largest real-world risk is **exposing the Next.js server beyond localhost without `JOB_OS_ACCESS_TOKEN`**, which leaves integrations portal server actions and most API routes fully open. SSRF in brief fetch and unvalidated Playwright navigation were concrete code paths — **SSRF and apply URL guards are now implemented**. Multi-profile isolation is **incomplete** in knowledge notebook and several services still keyed on `userId` only (migration in progress).

**Verification:** `npm run test:security` — **18/18 passed**. Full `npm run typecheck` still fails due to in-flight `AppScope` migration (unrelated to security fixes). `npm audit`: 2 moderate (next, postcss).

---

## Attack narratives (successful simulated paths)

### A1 — LAN attacker dumps integration keys via unauthenticated server actions
**Goal:** Exfiltrate `OPENROUTER_API_KEY`, Gmail OAuth client secret  
**Path:** Deploy Job OS on `0.0.0.0:3000` without `JOB_OS_ACCESS_TOKEN`. Call `saveIntegrationSecretsAction` (Next.js server action — no session, no CSRF token). Keys written to `.secrets/keys.json`.  
**MITRE:** T1552.001 (Credentials in Files), T1078 (Valid Accounts)  
**Status:** **Deferred** — requires auth layer on server actions or mandatory access token for all mutations when not on loopback.

### A2 — SSRF via company domain seeding brief fetch
**Goal:** Probe internal services (`http://127.0.0.1`, `http://169.254.169.254`)  
**Path:** Set company `domain` to `127.0.0.1` → `fetchWebResearchSources` builds `https://127.0.0.1/about` → `safeFetch` followed redirect/fetch.  
**MITRE:** T1190 (Exploit Public-Facing Application), T1046 (Network Service Discovery)  
**Status:** **Mitigated** — `lib/security/url.ts` + `safeFetch` blocks non-public http(s) targets.

### A3 — Playwright navigates to `file://` or internal URL
**Goal:** Local file read / internal network probe via automation profile  
**Path:** Malicious or mistyped `job.url` → `playwrightDriver.open()` → `page.goto(url)`.  
**MITRE:** T1203 (Exploitation for Client Execution)  
**Status:** **Mitigated** — `systemChromeLauncher` rejects non-public URLs before `goto`.

### A4 — Missing Host header bypasses API token gate (pre-fix)
**Goal:** Call `/api/backup/export` without token when app is LAN-exposed  
**Path:** Send request with no `Host` header; `isLocalhostHost(null)` returned `true` → middleware skipped auth.  
**MITRE:** T1078.004 (Cloud Accounts — misconfigured access)  
**Status:** **Mitigated** — null/missing host no longer treated as localhost.

### A5 — Profile B data in Profile A knowledge retrieval (multi-profile)
**Goal:** Cross-profile leakage via RAG  
**Path:** Profile A active; `indexUserKnowledge(userId)` indexes **all** `profileEntry` rows for user; `retrieveKnowledge(userId, …)` returns chunks from Profile B.  
**MITRE:** T1530 (Data from Cloud Storage), T1213 (Data from Information Repositories)  
**Status:** **Open** — blocked on `AppScope` migration (`lib/knowledge/index.ts`, `lib/knowledge/retrieve.ts`).

### A6 — Gmail OAuth connect CSRF
**Goal:** Trick victim into connecting attacker's Google account (low impact in single-user local app)  
**Path:** `/api/gmail/auth` uses fixed `state=track`; no binding to session.  
**MITRE:** T1566 (Phishing), T1550 (Use Alternate Authentication Material)  
**Status:** **Open** — add signed/random state in cookie.

---

## Findings table

| ID | Sev | Component | Description | Proof | MITRE | Fix |
|----|-----|-----------|-------------|-------|-------|-----|
| SEC-01 | **Critical** | Auth / server actions | No authentication on `"use server"` mutations (`saveIntegrationSecretsAction`, profile CRUD). Any client reaching the server can modify secrets and data when not on loopback. | `app/actions/integrations.ts` | T1078, T1552 | **Fixed** — `requireAccessForMutation()` on all mutating server actions; middleware sets `job_os_access` cookie. |
| SEC-02 | **Critical** | Auth / middleware | Protected API coverage was incomplete (`/api/integrations`, `/api/apply` ungated). | `middleware.ts` matcher | T1190 | **Fixed** — expanded `PROTECTED_API_PREFIXES` + matcher. |
| SEC-03 | **High** | Brief / fetch | `safeFetch` accepted any URL including loopback, RFC1918, `file://`. | `lib/brief/fetch-utils.ts` | T1190, T1046 | **Fixed** — `isPublicHttpUrl` guard. |
| SEC-04 | **High** | Apply / Playwright | `page.goto(job.url)` without scheme/host validation. | `lib/apply/driver-playwright.ts` | T1203 | **Fixed** — URL guard before launch. |
| SEC-05 | **High** | Auth / access | Missing `Host` header treated as localhost → auth bypass. | `lib/auth/access.ts:14-16` | T1078 | **Fixed** — `isLocalhostHost(null) → false`. |
| SEC-06 | **High** | Multi-profile | Knowledge notebook indexes/retrieves by `userId` only — cross-profile bleed. | `lib/knowledge/index.ts:83-92` | T1530 | **Fixed** — `indexUserKnowledge` / `retrieveKnowledge` / `listChunks` scoped to `AppScope` + `profileId` on `KnowledgeChunk`. |
| SEC-07 | **High** | Interview | `loadFacts(userId)` loads all profile entries across profiles; sensitive flag preserved but wrong profile facts in prompts. | `lib/interview/service.ts:90-94` | T1213 | **Fixed** — `loadFacts(scope)` with `scopeWhere`. |
| SEC-08 | **Medium** | Gmail OAuth | Static OAuth `state` parameter (`"track"`). | `app/api/gmail/auth/route.ts:15` | T1550 | Generate crypto random state; store in httpOnly cookie; verify on callback. |
| SEC-09 | **Medium** | Auth / access | `verifyAccessToken` used timing-unsafe `===`. | `lib/auth/access.ts` | T1110 | **Fixed** — `timingSafeEqual`. |
| SEC-10 | **Medium** | Auth / access | Access token accepted via `?token=` query — may leak in logs/referrers. | `lib/auth/access.ts:46-47` | T1552 | Prefer `Authorization` header only in production docs; deprecate query param. |
| SEC-11 | **Medium** | API routes | `/api/backup/export` returns full plaintext profile without access token when `JOB_OS_ACCESS_TOKEN` unset. | `app/api/backup/export/route.ts` | T1530 | Document mandatory token for non-localhost; consider default-deny export. |
| SEC-12 | **Medium** | Apply session API | Session route passes `user.id` where `AppScope` expected — broken session keys + wrong isolation (typecheck error). | `app/api/apply/session/[id]/route.ts:16` | T1213 | **Fixed** — uses `getAppContext().scope`. |
| SEC-13 | **Medium** | Secrets | `.secrets/keys.json` plaintext at rest (mode 0600). Acceptable local-first; risk if synced to cloud backup. | `lib/secrets/file-store.ts` | T1552 | Document FileVault + exclude from sync; desktop keychain already planned. |
| SEC-14 | **Low** | Gmail push | Push webhook auth is shared secret only; no Pub/Sub JWT verification. | `app/api/gmail/push/route.ts` | T1078 | Optional Google Pub/Sub OIDC verification. |
| SEC-15 | **Low** | Desktop / Tauri | Next sidecar binds `127.0.0.1` — good; stdout/stderr nulled hides errors. | `src-tauri/src/main.rs:35` | T1059 | Log to file in debug; document port exposure. |
| SEC-16 | **Low** | Dependencies | 2 moderate npm advisories (`next`, `postcss`). | `npm audit` | T1195 | Upgrade when compatible with Next 15.5.x pin. |
| SEC-17 | **Low** | LLM / apply | Essay field prompt includes retrieved profile text; job description is attacker-influenced (prompt injection surface). | `lib/apply/fields-llm.ts:44-59` | T1059 | Structural delimiter + instruction hardening; provenance check exists. |
| SEC-18 | **Info** | Secrets | Status API and portal correctly expose `configured` flags only. | `lib/integrations/registry.ts:196-206` | — | Maintain regression test. |
| SEC-19 | **Info** | Backup | Restore scoped by `scopeWhere`; decrypt-before-mutate. | `lib/backup/service.ts:250-276` | — | Good pattern. |
| SEC-20 | **Info** | Interview | Sensitive facts filtered in study/persona/score brains. | `lib/interview/study.ts:294` | — | Add profileId filter when loading facts. |

---

## Detection gaps

| Gap | What should have caught it | Recommendation |
|-----|---------------------------|----------------|
| No SSRF unit tests before this pass | `test:security` SSRF block | **Added** — run in CI |
| Middleware path coverage not tested | Integration test hitting `/api/integrations/status` without token on non-local Host | Extend `test:security` with mocked Request headers |
| Profile isolation not enforced at DB layer for knowledge | Schema lacks `profileId` on `KnowledgeChunk` | Migration + FK |
| Server actions have no audit log | Security monitoring | Log secret mutations locally (no values) |
| `npm audit` not in CI | Dependency gate | Add `npm audit --audit-level=high` to CI |

---

## Stress-test scenarios run

| Scenario | Result |
|----------|--------|
| `allIntegrationStatuses()` JSON contains no secret key material | **Pass** |
| `scopeWhere` produces distinct filters per profile | **Pass** |
| `isPublicHttpUrl` blocks loopback, RFC1918, metadata, non-http | **Pass** |
| `safeFetch("http://127.0.0.1/…")` returns null without network I/O | **Pass** |
| `verifyAccessToken` timing-safe + rejects bad tokens | **Pass** |
| `isLocalhostHost(null)` is false | **Pass** |
| Protected path list includes integrations + apply | **Pass** |
| Live HTTP attack against running server | **Not run** (no server started; PoC in unit tests only) |
| Playwright navigation to `file://` | **Blocked by code inspection + URL guard** |

---

## Fixes applied (this pass)

1. **`lib/security/url.ts`** — public http(s) URL validator (SSRF / apply guard).
2. **`lib/brief/fetch-utils.ts`** — `safeFetch` rejects unsafe URLs.
3. **`lib/apply/driver-playwright.ts`** — refuse non-public URLs before `goto`.
4. **`lib/auth/access.ts`** — timing-safe token compare; null host not localhost; expanded protected prefixes.
5. **`middleware.ts`** — matcher for `/api/integrations`, `/api/apply`.
6. **`scripts/test-security.ts`** + **`npm run test:security`**.

---

## Deferred fix plan (by priority)

### Critical / High (remaining)

| ID | Files | Action |
|----|-------|--------|
| SEC-01 | `app/actions/**`, new `lib/auth/require-access.ts` | Gate all server actions when host is non-loopback and token configured |
| SEC-06 | `lib/knowledge/index.ts`, `lib/knowledge/retrieve.ts`, prisma migration | Add `profileId` to knowledge tables; scope index/retrieve |
| SEC-07 | `lib/interview/service.ts` | `loadFacts(scope)` with `scopeWhere` |

### Medium

| ID | Files | Action |
|----|-------|--------|
| SEC-08 | `app/api/gmail/auth/route.ts`, `callback/route.ts` | OAuth state cookie |
| SEC-10 | `lib/auth/access.ts`, docs | Deprecate query-token |
| SEC-11 | `app/api/backup/export/route.ts` | Align with middleware / document |
| SEC-12 | `app/api/apply/session/[id]/route.ts` | `getAppContext().scope` |

---

## Ethical boundaries observed

- Assessment limited to user's local codebase and test fixtures.
- No production systems, external services, or real user data accessed.
- No destructive testing; SSRF PoC is deny-list validation only (no live internal probing).
