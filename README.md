# Job OS

Local-first AI job-search operating system: discover roles, research companies, tailor resumes, apply with human review gates, track Gmail proposals, and practice interviews — all on your machine.

## Quickstart (~10 minutes)

### 1. Prerequisites

- Node.js 22+
- Docker (for Postgres + pgvector)
- Optional: Google Chrome (Playwright apply driver), API keys (see step 4)

### 2. Install

```bash
git clone <your-repo-url> job-os && cd job-os
cp .env.example .env
npm install
```

### 3. Database

```bash
npm run db:up
npm run db:generate
npx prisma migrate deploy
# optional seed:
npm run db:seed
```

### 4. Integrations (API keys)

Open **http://localhost:3000/integrations** after starting the dev server, or set keys in `.env`:

| Key | Required? | Purpose |
|-----|-----------|---------|
| `OPENROUTER_API_KEY` | Recommended | AI features (briefs, tailor, goals) |
| `JSEARCH_API_KEY` | Optional | Paid job search spine |
| `ELEVENLABS_API_KEY` + agent IDs | Optional | Live voice interview modes |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | Optional | Gmail track (propose-only) |
| `JOB_OS_ACCESS_TOKEN` | LAN only | Bearer auth when not on localhost |

See `.env.example` for the full list with documentation.

### 5. Run

```bash
npm run dev
```

Smoke URLs:

- http://localhost:3000 — dashboard
- http://localhost:3000/setup — setup wizard
- http://localhost:3000/jobs — discover + score
- http://localhost:3000/apply — review gate
- http://localhost:3000/track — Gmail kanban (fixtures without OAuth)

### 6. Verify

```bash
npm run typecheck
npm run build
npm run test:security
npm run test:e2e-journey
```

## Architecture

- **Next.js 16** app with server actions
- **Postgres + pgvector** via Prisma
- **Secrets**: Integrations portal → `.secrets/keys.json` → `.env` fallback
- **Apply**: Simulated driver (default) or opt-in Playwright (`APPLY_DRIVER=playwright`)
- **Autopilot**: Discover → brief → prepare → auto-submit **AUTONOMOUS** routes only

### Documentation

| Doc | Contents |
|-----|----------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Domain map, adapter seams, fixture vs live matrix |
| [docs/backend-api.md](./docs/backend-api.md) | API routes, server actions, auth & error contracts |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Docker, env checklist, LAN security, `.secrets` hygiene |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run catchup` | Run due scheduler jobs (discover, autopilot, backup) |
| `npm run backup` | Encrypted profile snapshot |
| `npm run db:studio` | Prisma Studio |

## Troubleshooting

### Stale `.next` cache

If the dev server shows blank pages, stale routes, or build errors after upgrading Next.js or renaming routes, stop the dev server first, then clear the cache:

```bash
# stop npm run dev (Ctrl+C), then:
rm -rf .next
npm run dev
```

Never delete `.next` while `next dev` is still running — file locks can leave a corrupt cache.

## Security notes

- Read and write server actions require an access token on non-localhost when `JOB_OS_ACCESS_TOKEN` is set
- Gmail and apply flows are human-in-the-loop by design
- Exclude `.secrets/` from cloud sync; enable FileVault on macOS

## Desktop (optional)

Packaged Tauri build with macOS Keychain secrets — see `src-tauri/README.md`.

**Platform priority:** local-first by default — primary target is a macOS desktop app (Tauri) with the same Next.js UI served locally; LAN web hosting is supported equally for the same workflow. LAN token entry UI is deferred.
