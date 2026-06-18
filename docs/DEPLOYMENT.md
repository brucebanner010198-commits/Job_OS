# Deployment

Job OS is designed to run **on your machine** — laptop, home LAN, or packaged Tauri desktop app. It is not a multi-tenant cloud SaaS. This guide covers Docker services, environment configuration, LAN exposure, and secrets hygiene.

---

## Prerequisites

| Requirement | Version / notes |
|-------------|-----------------|
| Node.js | 22+ |
| Docker | For Postgres + pgvector |
| Google Chrome | Required only for Playwright apply driver |
| macOS FileVault | Strongly recommended for at-rest encryption |

---

## Quick deploy (local dev)

```bash
git clone <repo-url> job-os && cd job-os
cp .env.example .env
npm install
npm run db:up          # starts Postgres container
npm run db:generate
npx prisma migrate deploy
npm run dev            # http://localhost:3000
```

Verify:

```bash
npm run typecheck
npm run build
curl -s http://localhost:3000/api/health | jq .
```

---

## Docker services

### Postgres + pgvector (required)

File: `docker-compose.yml`

```bash
npm run db:up      # docker compose up -d
npm run db:down    # docker compose down
```

| Setting | Value |
|---------|-------|
| Image | `pgvector/pgvector:pg17` |
| Container | `jobos-db` |
| Port | `5432` |
| User / password / DB | `jobos` / `jobos` / `jobos` |
| Volume | `jobos-db-data` (named Docker volume) |
| Healthcheck | `pg_isready` every 5s |

Default `DATABASE_URL`:

```
postgresql://jobos:jobos@localhost:5432/jobos?schema=public
```

### Pipecat voice runner (optional)

File: `docker-compose.voice.yml`

```bash
docker compose -f docker-compose.voice.yml up -d
```

Exposes `http://localhost:8765/connect` — set `PIPECAT_CONNECT_URL` in Integrations or `.env`.

This is an **optional OSS voice fallback** (Whisper + Kokoro + OpenRouter on the runner). ElevenLabs remains the primary live voice path.

---

## Production build

```bash
npm run build
npm run start        # listens on PORT (default 3000)
```

Standalone packaging:

```bash
npm run build:standalone
```

Desktop (Tauri + macOS Keychain): see `src-tauri/README.md`. Set `JOB_OS_DESKTOP=1` so secrets resolve from Keychain instead of `.env`.

---

## Environment checklist

Copy `.env.example` → `.env`. Prefer the **Integrations portal** (`/integrations`) for API keys — values are written to `.secrets/keys.json` and override empty env vars.

### Core (required for full functionality)

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `DATABASE_URL` | Yes | Postgres connection string |
| `APP_URL` | Yes | Base URL for OAuth redirects (e.g. `http://localhost:3000`) |
| `PRIMARY_USER_EMAIL` | Recommended | Stable local user identity |
| `OPENROUTER_API_KEY` | Recommended | AI features (briefs, tailor, goals, extraction) |

### Access control (LAN / non-loopback)

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `JOB_OS_ACCESS_TOKEN` | **Required on LAN** | Shared bearer token for API + server actions |

When set, any host that is **not** loopback must present the token. Loopback (`localhost`, `127.0.0.1`, `::1`) is always trusted.

### Job discovery

| Variable | Default | Purpose |
|----------|---------|---------|
| `JOBS_DEFAULT_QUERY` | `software engineer` | Default search query |
| `JOBS_USE_FIXTURES` | `1` | Built-in offline jobs |
| `JOBS_FREE_SOURCES` | `1` | Remotive, RemoteOK, Arbeitnow, Jobicy |
| `JSEARCH_API_KEY` | — | Optional paid spine |
| `SCORING_MODE` | `embedding` | `embedding` or `lexical` |

### Gmail track

| Variable | Purpose |
|----------|---------|
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | OAuth app credentials |
| `GMAIL_REDIRECT_URI` | Default `http://localhost:3000/api/gmail/callback` |
| `GMAIL_ENABLED` | `0` forces fixtures |
| `GMAIL_PUBSUB_TOPIC` | Optional push relay topic |
| `GMAIL_PUSH_TOKEN` | Shared secret for `/api/gmail/push` |
| `GMAIL_PUSH_ENABLED` | `0` disables push webhook |

### Apply engine

| Variable | Default | Purpose |
|----------|---------|---------|
| `APPLY_DRIVER` | (simulated) | Set `playwright` for real Chrome |
| `APPLY_DRY_RUN` | — | `1` = fill but never submit |
| `APPLY_HEADLESS` | visible | `1` = headless Chrome |
| `APPLY_CHROME_PROFILE_DIR` | `.secrets/apply-chrome-profile` | Persistent automation profile |
| `APPLY_RESUME_PDF` | `.secrets/resume.pdf` | PDF for file upload |
| `JOB_OS_CLOUD` | — | `1` disables Playwright + warm LinkedIn |

### Voice interview

| Variable | Purpose |
|----------|---------|
| `ELEVENLABS_API_KEY` | Live ConvAI (server-side only) |
| `ELEVENLABS_AGENT_AI_SCREEN` / `ELEVENLABS_AGENT_REAL_HR` | Agent IDs |
| `ELEVENLABS_VOICE_DISABLED` | `1` = force fixture mock |
| `PIPECAT_CONNECT_URL` | OSS voice runner endpoint |
| `VOICE_PROVIDER` | Optional preference override |

### Autopilot & quality gate

| Variable | Purpose |
|----------|---------|
| `AUTOPILOT_ENABLED` | Chain discover → brief → prepare → auto-submit AUTONOMOUS |
| `QUALITY_GATE_MIN_JOB_SCORE` | Minimum fit score |
| `QUALITY_GATE_MIN_SCREENING` | Minimum ATS screening score |
| `QUALITY_GATE_MAX_DAILY_AUTO` | Daily auto-submit cap |

### Backups

| Variable | Purpose |
|----------|---------|
| `BACKUP_KEY` | Optional custom AES-256 key (32 bytes); auto-generated to `.secrets/backup.key` if unset |

Encrypted snapshots live under `/.backups/` (gitignored).

### Model routing

| Variable | Default |
|----------|---------|
| `MODEL_CHEAP` | `google/gemini-2.5-flash-lite` |
| `MODEL_STANDARD` | `google/gemini-2.5-flash` |
| `MODEL_STRONG` | `anthropic/claude-sonnet-4.6` |
| `EMBEDDING_MODEL` | `openai/text-embedding-3-small` |
| `OPENROUTER_ENFORCE_ZDR` | `1` |

See `.env.example` for the complete annotated list.

---

## LAN security

Job OS assumes **local-first trust on loopback** and **explicit hardening when exposed on a home/office LAN** (e.g. `next start -H 0.0.0.0`).

### 1. Set an access token

```bash
# .env
JOB_OS_ACCESS_TOKEN=$(openssl rand -hex 32)
```

All protected API routes and server actions require this token when the `Host` header is not loopback.

### 2. Present the token

Preferred methods (in order):

1. `Authorization: Bearer <JOB_OS_ACCESS_TOKEN>`
2. `x-job-os-token: <token>` header
3. `job_os_access` httpOnly cookie (set automatically after a valid Bearer token hits a protected API route via `proxy.ts`)

Deprecated: `?token=` query param (leaks in logs/referrers).

### 3. Protected surfaces

| Surface | Protection |
|---------|------------|
| `/api/backup/*` | Middleware + export route double-check |
| `/api/integrations/*` | Middleware |
| `/api/apply/*` | Middleware |
| `/api/gmail/*` (except OAuth) | Middleware |
| Server actions (reads/writes) | `requireAccessForRead/Mutation()` |
| `/api/health` | Public |
| `/api/gmail/auth`, `/api/gmail/callback` | OAuth exempt |
| `/api/gmail/push` | Separate `GMAIL_PUSH_TOKEN` |

### 4. Rate limiting

LAN clients on protected API prefixes: **100 requests/minute per IP**. Returns `429` with `Retry-After`.

### 5. Default-deny export

`GET /api/backup/export` returns plaintext profile JSON. Off loopback, export is blocked unless `JOB_OS_ACCESS_TOKEN` is configured **and** presented — preventing accidental LAN data leaks.

### 6. Do not expose to the public internet

The bearer-token model is appropriate for **trusted LAN devices only**, not internet-facing deployment. There is no OIDC, RBAC, or CSRF token on server actions — by design for single-user local-first use.

---

## `.secrets` directory

All sensitive local state lives under `.secrets/` (gitignored, mode `0700`).

| Path | Contents | Permissions |
|------|----------|-------------|
| `.secrets/keys.json` | Integration API keys (portal writes) | `0600` |
| `.secrets/gmail-{profileId}.json` | Gmail OAuth tokens | `0600` |
| `.secrets/backup.key` | AES-256 backup encryption key | `0600` |
| `.secrets/apply-chrome-profile/` | Playwright Chrome user data | `0700` |
| `.secrets/resume.pdf` | Optional master resume PDF for apply upload | user-managed |

### Resolution order

```
Web/dev:     .secrets/keys.json  →  .env
Desktop:     macOS Keychain      →  .secrets/keys.json  →  .env
```

Never commit `.secrets/`. Never log secret values. Integration status APIs return `configured: true/false` only.

### Sync and backup hygiene

| Do | Don't |
|----|-------|
| Enable **FileVault** (macOS) for full-disk encryption | Sync `.secrets/` to iCloud, Dropbox, or Time Machine without exclusion |
| Exclude `.secrets/` and `/.backups/` from cloud backup tools | Share the repo with `.secrets` accidentally |
| Keep `apply-chrome-profile` local-only (contains session cookies) | Run Playwright apply on `JOB_OS_CLOUD=1` |

### First-time secrets setup

1. Start the app: `npm run dev`
2. Open `/integrations` and paste API keys — saved to `.secrets/keys.json`
3. For Gmail: set client id/secret in Integrations, then **Connect Gmail** on `/track`
4. For backups: run `npm run backup` — encryption key auto-created at `.secrets/backup.key`

---

## Scheduled jobs (optional)

The catch-up runner executes due background jobs idempotently:

```bash
npm run catchup
```

Schedule via macOS launchd — the `/outcomes` Automation panel generates an agent template. Jobs include discover, autopilot, and backup when due.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `503` on `/api/health` | `npm run db:up`; check `DATABASE_URL` |
| `401 unauthorized` on LAN | Set and send `JOB_OS_ACCESS_TOKEN` |
| Blank pages after upgrade | Stop dev server, `rm -rf .next`, restart |
| Playwright apply won't start | Install Chrome; set `APPLY_DRIVER=playwright`; ensure `JOB_OS_CLOUD` unset |
| Gmail tokens expire (test mode) | Publish OAuth consent to **In production** in Google Cloud Console |

---

## Related docs

- [Backend architecture & adapter seams](./ARCHITECTURE.md)
- [API routes & server actions](./backend-api.md)
