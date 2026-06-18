# Job OS — Ready for User

**READY: yes**

**Verified:** 2026-06-18 (end-to-end readiness pass)

**Working URL:** http://localhost:3000 (dev server running; do not restart unless routes fail)

---

## Verification summary

| Check | Result |
|-------|--------|
| `curl /` | 200 |
| `curl /setup` | 200 |
| `curl /integrations` | 200 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0 (writes `.next-build`) |
| `npm run test:e2e-journey` | 10/10 passed |
| `npm run test:security` | 22/22 passed |
| `npm run test:screening` | 20/20 passed |
| `ps aux \| grep AGENT_LOOP` | No destructive loops running |
| Dev server after build | Still 200 on `/`, `/setup`, `/integrations` |

**Fixes applied this pass:** none — all gates green on first run.

---

## 10-minute smoke test (for you)

1. **Confirm stack** — Open http://localhost:3000. Dashboard should load with sidebar, theme toggle, and profile switcher.

2. **Setup wizard** — Visit `/setup`. Stepper loads; links to import, goals, and integrations work.

3. **Integrations portal** — Visit `/integrations`. Paste `OPENROUTER_API_KEY` (recommended). Save and confirm status badges update; key values must never appear in the UI.

4. **Profile switch** — Create or switch profiles in the sidebar footer. Data should stay isolated per profile.

5. **Jobs discover** — Visit `/jobs`. Run discovery (works offline with fixtures). Expand a row — ATS match panel and route badge visible.

6. **Apply gate** — Visit `/apply`. REVIEW gate UI and autopilot policy callout should be present.

7. **Track (mock)** — Visit `/track`. Kanban loads with fixture proposals (no Gmail OAuth required).

8. **Interview fixture** — Visit `/interview`. Start a SCRIPTED MOCK session (no ElevenLabs key). Readiness gate + transcript flow should work.

9. **Company brief** (optional, needs OpenRouter) — Visit `/companies`. Generate a brief; verify cited sources badge.

10. **Regression spot-check** (optional)
    ```bash
    npm run typecheck
    npm run test:security
  npm run test:e2e-journey
    ```

---

## API keys needed

Configure at **http://localhost:3000/integrations** (preferred) or in `.env`:

| Key | Required? | Unlocks |
|-----|-----------|---------|
| `OPENROUTER_API_KEY` | **Recommended** | Live AI: resume import, dictation, tailor, briefs, goals |
| `JSEARCH_API_KEY` | Optional | Paid job search spine (OSS sources work without it) |
| `ELEVENLABS_API_KEY` + agent IDs | Optional | Live voice interview (fixture mock works without) |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | Optional | Live Gmail track (fixture proposals work without) |
| `JOB_OS_ACCESS_TOKEN` | LAN only | Bearer auth when not on localhost |

Without OpenRouter, E2E steps 1–2 fall back to fixture seed — the app is usable, but live AI features need the key.

---

## What's done vs optional follow-ups

### Done (this session)

- Phases 1–6 master plan: multi-profile, theme, Next 16, Prisma 7, TS 5.9.3
- Craftsmanship pass: copy cleanup, 34/34 core tests green
- Logo consistency: favicon, Tauri icons, apple-icon, global-error color
- Dev/build cache split: dev → `.next`, production build → `.next-build`
- No destructive supervisor `AGENT_LOOP` processes

### Optional follow-ups (not blockers)

- **README logo** — Add branded logo asset to README header
- **OG image** — Social preview image for sharing
- **Tauri desktop build** — `npm run tauri build` for `.dmg` / native app packaging
- **Live AI smoke** — Paste OpenRouter key and re-run resume import + dictation manually
- **npm audit** — 2 moderate advisories (`next`, `postcss`); no high/critical

---

## Known gotchas

1. **Do not `rm -rf .next` while `npm run dev` is running** — it corrupts the dev cache and causes 500s. Stop dev first, or let it recover on its own.

2. **Production builds use `.next-build`** — `npm run build` is safe alongside a running dev server; it does not touch `.next`.

3. **No destructive supervisor loops** — Past `AGENT_LOOP` scripts caused repeated 500s. Do not re-enable aggressive restart/kill loops.

4. **OpenRouter 401 without key** — Expected; fixture fallbacks keep tests and offline flows working.

5. **LAN exposure** — Set `JOB_OS_ACCESS_TOKEN` before binding beyond localhost.

---

## Quick commands

```bash
npm run dev          # http://localhost:3000
npm run db:up        # Postgres + pgvector
npm run typecheck
npm run build        # → .next-build
npm run test:e2e-journey
npm run test:security
npm run test:screening
```
