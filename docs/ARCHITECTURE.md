# Architecture

Job OS is a **local-first** Next.js 16 application: Postgres + pgvector for structured data, server actions for mutations, and swappable **adapters** so every module works offline with fixtures when live services are unavailable.

## System layers

```
┌─────────────────────────────────────────────────────────────┐
│  UI (app/(app)/*, components/*)                             │
├─────────────────────────────────────────────────────────────┤
│  Server actions (app/actions/*)  │  API routes (app/api/*)  │
├─────────────────────────────────────────────────────────────┤
│  Domain services (lib/*/service.ts) — Prisma boundary       │
├─────────────────────────────────────────────────────────────┤
│  Pure logic (engine, scoring, state machines)               │
├─────────────────────────────────────────────────────────────┤
│  Adapters (sources, drivers, voice, OAuth)                  │
├─────────────────────────────────────────────────────────────┤
│  Postgres + pgvector  │  .secrets/  │  /.backups             │
└─────────────────────────────────────────────────────────────┘
```

- **Services** own all database I/O for a domain.
- **Engines** are pure (no DB, no network) — e.g. `lib/apply/engine.ts`, `lib/scoring/score.ts`.
- **Adapters** implement narrow interfaces and are selected at runtime by env + configuration.

Access control: `proxy.ts` gates protected API prefixes; server actions use `lib/auth/require-access.ts`. Loopback is always trusted.

---

## Domain map (`lib/modules.ts`)

The module registry drives the dashboard and navigation. Each module has:

| Field | Meaning |
|-------|---------|
| `uiStatus` | Page/workflow completeness (`ready` / `building` / `planned`) |
| `liveStatus` | Production adapter wiring (`live` / `partial` / `fixture`) |
| `phase` | Implementation phase in the master plan |
| `href` | Primary route |

### Modules by phase

| Phase | Module ID | Name | UI | Live |
|-------|-----------|------|-----|------|
| 1 | `import` | Cold-start Import | ready | partial |
| 1 | `master-resume` | Master Resume | ready | live |
| 1 | `resume` | Tailored ATS Resume | ready | live |
| 1 | `cover-letter` | Cover Letter | ready | live |
| 1 | `integrations` | Integrations | ready | live |
| 2 | `goals` | Career Goals | ready | live |
| 3 | `jobs` | Job Engine | ready | partial |
| 4 | `company-brief` | Company Brief | ready | partial |
| 5 | `apply` | Apply Engine | ready | partial |
| 6 | `tracker` | Tracker + Gmail | ready | partial |
| 7 | `warm-path` | Warm-Path / Referrals | ready | fixture |
| 7 | `linkedin` | LinkedIn Optimizer | ready | fixture |
| 7 | `boosters` | Funnel Boosters | ready | live |
| 7 | `training` | Job Training Hub | ready | live |
| 9 | `outcomes` | Outcomes & Automation | ready | live |
| 11 | `backups` | Backups & Export | ready | live |

### Key code locations

| Module | Primary lib paths | Server actions |
|--------|-------------------|----------------|
| Import / master resume | `lib/profile/`, `lib/import/` | `app/actions/profile.ts`, `onboarding.ts` |
| Resume / cover letter | `lib/resume/`, `lib/coverletter/` | `app/actions/resume.ts` |
| Goals | `lib/goals/` | `app/actions/goals.ts`, `dream-companies.ts` |
| Jobs | `lib/jobs/` | `app/actions/jobs.ts` |
| Company brief | `lib/brief/` | `app/actions/brief.ts` |
| Apply | `lib/apply/` | `app/actions/apply.ts` |
| Track + Gmail | `lib/track/`, `lib/gmail/` | `app/actions/track.ts` |
| Warm path | `lib/warm/` | `app/actions/warm.ts` |
| Interview | `lib/interview/` | `app/actions/interview.ts` |
| LinkedIn audit | `lib/linkedin/` | `app/actions/linkedin.ts` |
| Follow-ups | `lib/followup/` | `app/actions/followup.ts` |
| Integrations | `lib/integrations/`, `lib/secrets/` | `app/actions/integrations.ts` |
| Backups | `lib/backup/` | API routes under `app/api/backup/` |
| Profiles | `lib/profiles/` | `app/actions/profiles.ts` |

---

## Adapter seams

Extend production behavior by adding adapters behind these interfaces — never fork business logic in UI or actions.

### Jobs — `lib/jobs/sources/index.ts`

| Adapter | File | Enable condition |
|---------|------|------------------|
| Fixtures | `sources/fixtures.ts` | `JOBS_USE_FIXTURES≠0` (default on) |
| JSearch (paid) | `sources/jsearch.ts` | `JSEARCH_API_KEY` set |
| Remotive | `sources/remotive.ts` | `JOBS_FREE_SOURCES≠0` |
| RemoteOK | `sources/remoteok.ts` | `JOBS_FREE_SOURCES≠0` |
| Arbeitnow | `sources/arbeitnow.ts` | `JOBS_FREE_SOURCES≠0` |
| Jobicy | `sources/jobicy.ts` | `JOBS_FREE_SOURCES≠0` |

**Add new work as:** a new `JobSource` file + register in `SOURCES[]`.

`discover()` runs all enabled sources concurrently; failed sources are skipped silently.

---

### Company brief — `lib/brief/sources.ts`

| Adapter | Purpose |
|---------|---------|
| Official site | Company domain fetch |
| News | News article search |
| Wikipedia | Wiki passage (never classified as official/news) |
| Web research | LLM-assisted research with citations |
| SEC EDGAR | US public-company filings |
| Wikidata | Structured entity data |
| Fixtures | Offline deterministic briefs |

**Add new work as:** a new fetch function merged in `fetchSources()`. Constraints: dedupe by URL, record `retrievedAt`, never throw from fetch layer.

---

### Apply driver — `lib/apply/driver.ts`

| Driver | File | When active |
|--------|------|-------------|
| Simulated (default) | `driver-simulated.ts` | Default; always available offline |
| Playwright | `driver-playwright.ts` | `APPLY_DRIVER=playwright` AND `JOB_OS_CLOUD≠1` |

**Interface:** `ApplyDriver` in `lib/apply/types.ts` — `open`, `scan`, `fill`, optional `attachResume`, `submit`, optional `close`.

**Add new work as:** implement `ApplyDriver` and register in `resolveApplyDriver()`.

Related pure modules (no adapter swap): `engine.ts` (field plan), `router.ts` (AUTONOMOUS/ASSISTED/MANUAL), `state-machine.ts`, `session-service.ts` (Postgres-backed cooperative control).

---

### Interview voice — `lib/interview/index.ts`

**Selection chain:** ElevenLabs → local Pipecat → fixture mock.

| Provider | File | Enable condition |
|----------|------|------------------|
| ElevenLabs ConvAI | `voice-live.ts` | `ELEVENLABS_API_KEY` + agent IDs; not kill-switched |
| Pipecat / local | `voice-local.ts` | `PIPECAT_CONNECT_URL`; `CARTESIA_VOICE_DISABLED≠1` |
| Fixture | `voice-fixture.ts` | Fallback when live unavailable |

**Add new work as:** implement `VoiceSource` and wire into `selectVoiceProvider()`.

Study mode (`lib/interview/study.ts`) is always offline — no adapter required.

---

### Warm-path connections — `lib/warm/index.ts`

| Source | File | Live? |
|--------|------|-------|
| Fixtures | `source-fixture.ts` | Default |
| LinkedIn session | `source-live.ts` | Desktop seam only; `WARM_LINKEDIN_ENABLED=1`, not cloud |

**Add new work as:** implement `ConnectionSource` (`listConnections`, `isLive`, `id`).

Manual CSV / import paths bypass the live adapter entirely.

---

### AI gateway — `lib/ai/openrouter.ts`

Single OpenRouter client for chat + embeddings. Model routing via `lib/ai/models.ts` (`MODEL_CHEAP`, `MODEL_STANDARD`, `MODEL_STRONG`, task-based `modelForTask()`).

**Add new work as:** extend provider abstraction here if a second LLM backend is needed; all callers should go through this module.

---

### Gmail — `lib/gmail/`

| Component | Role |
|-----------|------|
| `oauth.ts` | OAuth consent + token exchange |
| `token-store.ts` | Tokens in `.secrets/gmail-{profileId}.json` |
| `push.ts` | Pub/Sub watch + push webhook verification |

Track service (`lib/track/service.ts`) is propose-only — never auto-applies status or sends mail.

---

### Secrets — `lib/secrets/`

Resolution order (web): `.secrets/keys.json` → `.env`. Desktop (`JOB_OS_DESKTOP=1`): macOS Keychain → file → env.

Integrations portal writes through `setSecret()`; reads use `getSecret()` everywhere adapters need keys.

---

## Fixture vs live matrix

Use `liveStatus` from `lib/modules.ts` in UI badges. Runtime behavior:

| Module | Live when | Fixture / offline fallback |
|--------|-----------|----------------------------|
| Master resume | OpenRouter for extraction | Rule-based / cached extraction paths |
| Jobs | Free OSS sources + optional JSearch | Built-in fixture jobs |
| Company brief | Network fetches + OpenRouter synthesis | Per-company fixture sources |
| Apply | Playwright when opted in | Simulated driver (default) |
| Track / Gmail | OAuth connected + `GMAIL_ENABLED` | Fixture proposals on `/track` |
| Interview voice | ElevenLabs or Pipecat configured | Scripted fixture mock |
| Warm path | LinkedIn desktop seam (future) | Deterministic fixture network |
| LinkedIn optimizer | Rules engine only today | N/A (no network) |

---

## Data & scope model

- **Single-user local-first:** `PRIMARY_USER_EMAIL` identifies the one user; multi-user is additive later.
- **Multi-profile:** `Profile` rows scoped by `userId`; active profile in cookie (`lib/app-context.ts`).
- **All queries** use `scopeWhere(scope)` from `lib/profiles/scope.ts` for tenant isolation.

---

## Background automation

| Job | Entry | Trigger |
|-----|-------|---------|
| Catch-up scheduler | `scripts/run-catchup.ts` (`npm run catchup`) | launchd / manual — discover, autopilot, backup |
| Autopilot | `lib/autopilot/` | `AUTOPILOT_ENABLED=1`; AUTONOMOUS routes only |
| Career agent | `lib/career/trigger.ts` | After profile/resume mutations |

---

## Related docs

Structured logging: `lib/observability/logger.ts`. Audit events: `lib/observability/audit.ts` (backup export, integration saves, profile deletes).

Health: `GET /api/health` — see [backend-api.md](./backend-api.md).
