# Backend API contracts

Job OS exposes **11 route modules** (grouped into **9 logical API areas**) and **15 server action modules**. All routes run in the Next.js App Router; server actions are invoked from client components and forms.

## Authentication model

| Context | Rule |
|---------|------|
| **Loopback** (`localhost`, `127.0.0.1`, `::1`) | Always trusted — no token required |
| **LAN / non-loopback** | When `JOB_OS_ACCESS_TOKEN` is set, protected routes and mutating server actions require a valid token |
| **Token presentation** | `Authorization: Bearer <token>`, `x-job-os-token` header, `?token=` query (deprecated), or `job_os_access` httpOnly cookie (set by `proxy.ts` after a valid Bearer/query token) |

Protected API prefixes (see `lib/auth/access.ts`):

- `/api/backup/*`
- `/api/gmail/*` (except OAuth — see exemptions)
- `/api/integrations/*`
- `/api/apply/*`

**Exempt paths** (no access token, even on LAN):

- `/api/gmail/auth` — OAuth kickoff redirect
- `/api/gmail/callback` — OAuth return redirect

**Public paths** (not in protected prefixes):

- `/api/health` — readiness probe

Server actions gate via `requireAccessForRead()` / `requireAccessForMutation()` in `lib/auth/require-access.ts`. On failure they throw `Unauthorized - send Authorization: Bearer or present a valid job_os_access cookie.`

LAN clients on protected prefixes are rate-limited to **100 req/min per IP** (`lib/security/rate-limit.ts`).

---

## API routes

### 1. Health — `GET /api/health`

| | |
|---|---|
| **Auth** | Public (loopback and LAN) |
| **Purpose** | Readiness snapshot for setup UX and ops |

**Response** `200` (DB ok) or `503` (DB down):

```json
{
  "status": "ok | degraded",
  "db": { "ok": true, "latencyMs": 12 } | { "ok": false, "error": "..." },
  "integrations": {
    "total": 8,
    "configured": 3,
    "enabled": 5,
    "items": [{ "id": "openrouter", "name": "...", "category": "ai", "configured": true, "enabled": true }]
  },
  "version": "0.1.0"
}
```

Never returns secret values.

---

### 2. Integrations status — `GET /api/integrations/status`

| | |
|---|---|
| **Auth** | Protected on non-loopback when `JOB_OS_ACCESS_TOKEN` set |
| **Purpose** | Safe integration configuration snapshot |

**Response** `200`:

```json
{
  "integrations": [
    { "id": "openrouter", "name": "OpenRouter", "category": "ai", "configured": true, "enabled": true }
  ]
}
```

**Errors:** `401 unauthorized`, `429 too_many_requests`

---

### 3. Integrations verify — `POST /api/integrations/verify`

| | |
|---|---|
| **Auth** | Protected on non-loopback when token set |
| **Body** | None |
| **Purpose** | Live connectivity probe (no secrets returned) |

**Response** `200`:

```json
{
  "openrouter": "ok | invalid | missing"
}
```

Probes OpenRouter via `GET https://openrouter.ai/api/v1/models` with the configured key.

---

### 4. Backup create — `POST /api/backup/create`

| | |
|---|---|
| **Auth** | Protected on non-loopback when token set |
| **Purpose** | Manual encrypted profile snapshot |

**Request body** (optional):

```json
{ "label": "before-major-edit" }
```

| Field | Type | Notes |
|-------|------|-------|
| `label` | `string?` | Trimmed, max 120 chars |

**Response** `200`:

```json
{ "ok": true, "record": { "...": "BackupRecord metadata" }, "deduped": false }
```

**Errors:** `500` `{ "ok": false, "error": "..." }`

---

### 5. Backup export — `GET /api/backup/export`

| | |
|---|---|
| **Auth** | Loopback always allowed; LAN requires valid token (also enforced in-route — default-deny off loopback without token) |
| **Purpose** | Plaintext JSON download of master profile |

**Response** `200` — `Content-Disposition: attachment; filename="job-os-profile-<stamp>.json"`

Body: portable profile export from `buildPlaintextExport()`.

**Errors:** `401 unauthorized`, `500` JSON error body

---

### 6. Backup restore — `POST /api/backup/restore`

| | |
|---|---|
| **Auth** | Protected on non-loopback when token set |
| **Purpose** | Restore profile from encrypted snapshot (pre-restore safety snapshot taken first) |

**Request body:**

```json
{ "backupId": "<cuid>" }
```

**Response** `200` / `400`:

```json
{ "ok": true, "result": { "...": "RestoreResult" } }
```

**Errors:** `400` missing `backupId` or restore failure; `500` server error

---

### 7. Gmail OAuth — `GET /api/gmail/auth`, `GET /api/gmail/callback`

| Route | Auth | Behavior |
|-------|------|----------|
| `GET /api/gmail/auth` | Exempt | Redirects to Google consent; sets httpOnly `GMAIL_OAUTH_STATE` cookie |
| `GET /api/gmail/callback` | Exempt | Exchanges code, stores tokens in `.secrets/`, redirects to `/track?gmail=connected\|error\|unconfigured` |

No JSON responses — browser redirects only.

---

### 8. Gmail watch — `POST /api/gmail/watch`, `DELETE /api/gmail/watch`

| | |
|---|---|
| **Auth** | Protected on non-loopback when token set |
| **Purpose** | Register or stop INBOX → Pub/Sub watch (~7 day expiry) |

**Response** `200` / `400`:

```json
{ "ok": true, "historyId": "...", "expiration": "..." }
// or
{ "ok": false, "reason": "Gmail not connected | GMAIL_PUBSUB_TOPIC not set | ..." }
```

---

### 9. Gmail push — `POST /api/gmail/push`

| | |
|---|---|
| **Auth** | `GMAIL_PUSH_TOKEN` via `?token=` or `x-relay-token` header (not `JOB_OS_ACCESS_TOKEN`) |
| **Purpose** | Pub/Sub webhook → idempotent inbox sync |

**Behavior:**

- `GMAIL_PUSH_ENABLED=0` → `204` no-op
- Invalid/missing push token → `401`
- Valid push → triggers `syncInbox()`; always returns `204` on authorized requests (avoids Pub/Sub retry storms)

---

### 10. Apply session — `GET|POST /api/apply/session/[id]`

| | |
|---|---|
| **Auth** | Protected on non-loopback when token set |
| **Purpose** | Cooperative Playwright session control (pause / handoff / resume) |

**GET** — fetch session state:

```json
{ "session": { "...": "ApplySession" } | null }
```

**POST** body:

```json
{ "action": "take-control | pause-captcha | resume-ai" }
```

**Response** `200`:

```json
{ "ok": true, "session": { "...": "ApplySession" } }
```

**Errors:** `400` `{ "error": "unknown action" }`

---

## Server actions

All actions live under `app/actions/`. Unless noted, mutations call `requireAccessForMutation()` and reads call `requireAccessForRead()`. Scope is resolved via `getAppContext()` (primary user + active profile).

Validation: high-risk inputs use Zod schemas in `lib/validation/action-schemas.ts` (`parseActionInput` throws user-safe `Error` on failure).

### `app/actions/profiles.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `listProfilesAction()` | read | — | `ProfileSummary[]` | Unauthorized |
| `getActiveProfileAction()` | read | — | `ProfileSummary` | Unauthorized |
| `switchProfileAction(profileId)` | mutation | `profileId: string` | `void` | Profile not found |
| `createProfileAction(name)` | mutation | `name: string` (Zod, max 64) | `ProfileSummary` | Validation error |
| `deleteProfileAction(profileId)` | mutation | `profileId` (Zod cuid) | `void` | Profile not found |

### `app/actions/integrations.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `listIntegrationsAction()` | read | — | `IntegrationView[]` (no secret values) | Unauthorized |
| `saveIntegrationSecretsAction(integrationId, values)` | mutation | `integrationId`, `values: Record<string,string>` (Zod) | `{ ok: true }` | Unknown integration, validation |
| `setIntegrationEnabledAction(integrationId, enabled)` | mutation | `integrationId`, `enabled: boolean` | `{ ok: true }` | No toggle on integration |

Writes secrets to `.secrets/keys.json` via `setSecret()` / `deleteSecret()`.

### `app/actions/apply.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `saveAnswersAction(data)` | mutation | `ApplicationAnswersData` | `{ ok: true }` | Unauthorized |
| `prepareApplicationAction(jobId)` | mutation | `jobId` (identity hash) | `{ ok: true }` | Service errors |
| `approveSubmitAction(applicationId)` | mutation | `applicationId` (Zod) | `{ ok: boolean, state: ApplyState }` | Validation |
| `takeControlAction(applicationId)` | mutation | `applicationId` | `{ ok: true }` | Unauthorized |
| `resumeAiAction(applicationId)` | mutation | `applicationId` | `{ ok: true }` | Unauthorized |

### `app/actions/dream-companies.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `loadDreamCompaniesAction()` | read | — | `DreamCompany[]` | Unauthorized |
| `saveDreamCompaniesAction(companies)` | mutation | `DreamCompany[]` | `{ ok: true }` | Unauthorized |

### `app/actions/track.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `syncInboxAction()` | mutation | — | `{ ok, created, proposals, live, error? }` | Returns `{ ok: false, error }` — never throws |
| `confirmProposalAction(proposalId)` | mutation | `proposalId` | `{ ok, error? }` | Caught errors in body |
| `dismissProposalAction(proposalId)` | mutation | `proposalId` | `{ ok, error? }` | Caught errors in body |
| `moveApplicationAction(applicationId, toStatus)` | mutation | `applicationId`, `AppStatus` | `{ ok: boolean }` | `{ ok: false }` on failure |
| `disconnectGmailAction()` | mutation | — | `{ ok: boolean }` | `{ ok: false }` on failure |

### `app/actions/jobs.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `discoverJobsAction(query)` | mutation | `query: string` (empty → `JOBS_DEFAULT_QUERY`) | `{ ingested, kept, filtered }` | Unauthorized |

### `app/actions/brief.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `generateBriefAction(name, domain?)` | mutation | `name`, optional `domain` | `SerializedBriefData` (dates as ISO strings) | Empty name throws |

### `app/actions/resume.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `createTargetAction(input)` | mutation | `CreateTargetInput` | `targetId: string` | Unauthorized |
| `tailorResumeAction(targetId)` | mutation | `targetId` | `TailorActionResult` (html, screening, violations, …) | Unauthorized |
| `generateCoverLetterAction(targetId)` | mutation | `targetId` | `CoverLetterActionResult` | Unauthorized |

### `app/actions/followup.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `refreshFollowUpsAction()` | mutation | — | `{ ok, error? }` | Never throws |
| `markFollowUpDoneAction(id)` | mutation | `id` | `{ ok, error? }` | Never throws |
| `dismissFollowUpAction(id)` | mutation | `id` | `{ ok, error? }` | Never throws |

### `app/actions/goals.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `suggestQuestionsAction()` | mutation | — | `string[]` | Unauthorized |
| `synthesizeGoalsAction(note)` | mutation | `note: string` | `CareerGoalData` | Empty note throws |
| `saveGoalsAction(data, rawNote)` | mutation | `CareerGoalData`, `rawNote` | `{ ok: true }` | Unauthorized |

### `app/actions/linkedin.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `auditProfileTextAction(text)` | mutation | pasted profile text | `AuditResult` | Unauthorized |
| `auditProfileAction(input)` | mutation | `LinkedInProfileInput` | `AuditResult` | Unauthorized |
| `seedFromMasterProfileAction()` | mutation | — | `string` (non-sensitive profile text) | Returns `""` if DB absent |

### `app/actions/interview.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `generateStudyGuideAction(company, applicationId)` | mutation | `company`, `applicationId \| null` | `{ ok: boolean }` | Never throws |
| `startSessionAction(company, applicationId, role, mode)` | mutation | company, ids, `InterviewMode` | `{ ok, decision, grant, persona, sessionId }` | Blocked day → `allowed: false` |
| `finishSessionAction(sessionId, transcript, durationSec, mode)` | mutation | session + transcript | `{ ok: boolean }` | Never throws |
| `abortSessionAction(sessionId)` | mutation | `sessionId` | `{ ok: boolean }` | Never throws |

### `app/actions/onboarding.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `startCoachingAction({ path, initialPaste? })` | mutation | `OnboardingPath`, optional paste | `CoachingTurnResult` | Unauthorized |
| `coachingTurnAction({ path, turns, userMessage, … })` | mutation | coaching state | `CoachingTurnResult` | Unauthorized |
| `compileOnboardingPreviewAction(input)` | mutation | path, turns, paste/resume | `{ profile, goals }` | Unauthorized |
| `completeOnboardingAction(input)` | mutation | path, turns, flags | `{ entriesAdded, goalsSaved, setupPartial }` | Unauthorized |
| `extractInitialPasteAction(text)` | mutation | `text` | `{ entryCount, preview }` | Empty → zeros |

### `app/actions/profile.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `saveDictationAction(rawText)` | mutation | `rawText` | `{ added, entries[] }` | Empty → `{ added: 0 }` |
| `importResumeAction(text)` | mutation | resume paste | `ImportResult` | Empty → zeros |
| `uploadResumeFileAction(formData)` | mutation | `FormData` with `file` | `ImportResult` | No file throws |

### `app/actions/warm.ts`

| Action | Auth | Input | Output | Errors |
|--------|------|-------|--------|--------|
| `refreshConnectionsAction()` | mutation | — | `{ ok, created, live, error? }` | Never throws |
| `generateIntroAction(company, applicationId)` | mutation | company, optional app id | `{ ok, error? }` | Never throws |
| `markIntroSentAction(id)` | mutation | intro id | `{ ok, error? }` | Never throws |
| `skipIntroAction(id)` | mutation | intro id | `{ ok, error? }` | Never throws |

---

## Error conventions

| Layer | Pattern |
|-------|---------|
| **API routes** | JSON `{ ok: false, error: "..." }` or `{ error: "unauthorized" }`; HTTP status reflects severity |
| **Server actions (strict)** | Throw `Error("message")` for validation / not-found (profiles, goals, integrations) |
| **Server actions (resilient)** | Return `{ ok: false, error?: string }` for track, warm, followup, interview (avoid RSC render crashes) |
| **Zod boundary** | `parseActionInput` → single human-readable message |

---

## Frontend handoff notes

- Treat server action signatures in this document as **stable contracts** for UI wiring.
- Use `GET /api/health` and `POST /api/integrations/verify` for setup / onboarding status UX.
- Show `liveStatus` badges from `lib/modules.ts` (`live` / `partial` / `fixture`) for modules whose adapters may be offline.
