# Production Ready Checklist

**Supervisor session:** 2026-06-18  
**Repo:** `/Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS`

| Item | Status | Notes |
|------|--------|-------|
| typecheck 0 errors | ✅ | `npm run typecheck` |
| build pass | ✅ | `npm run build` (clean `.next` required after parallel edits) |
| migrations applied | ✅ | 8 migrations, `prisma migrate deploy` — no pending |
| .env.example complete | ✅ | All integrations + quality gate + career agent + `.secrets/` doc |
| README quickstart | ✅ | `README.md` — install → db → migrate → integrations → dev |
| git initialized | ✅ | `git init` done; commit recommended when ready |

## test:* matrix (all pass)

| Script | Result |
|--------|--------|
| `test:provenance` | ✅ 11/11 |
| `test:coverletter-standards` | ✅ 17/17 |
| `test:screening` | ✅ 20/20 |
| `test:resume-skim` | ✅ 12/12 |
| `test:goals` | ✅ 13/13 |
| `test:scoring` | ✅ 42/42 |
| `test:jobs` | ✅ 34/34 |
| `test:brief` | ✅ 28/28 |
| `test:crunchbase` | ✅ 13/13 |
| `test:apply` | ✅ 58/58 |
| `test:apply-state` | ✅ 45/45 |
| `test:apply-driver` | ✅ 23/23 |
| `test:linkedin` | ✅ 41/41 |
| `test:track` | ✅ 69/69 |
| `test:warm` | ✅ 48/48 |
| `test:followup` | ✅ 37/37 |
| `test:salary` | ✅ 35/35 |
| `test:interview` | ✅ 50/50 |
| `test:voice` | ✅ 13/13 |
| `test:push` | ✅ 15/15 |
| `test:outcomes` | ✅ 73/73 |
| `test:career-agent` | ✅ 16/16 |
| `test:backup` | ✅ 38/38 |
| `test:desktop` | ✅ 15/15 |
| `test:integrations` | ✅ 9/9 |
| `test:profiles` | ✅ 8/8 |
| `test:security` | ✅ 22/22 |
| `test:brief-web-research` | ✅ 5/5 |
| `test:knowledge` | ✅ 2/2 |
| `test:autopilot` | ✅ 10/10 |
| `test:hire-probability` | ✅ 20/20 |
| `test:job-training` | ✅ 16/16 |
| `test:e2e-journey` | ✅ 10/10 |
| `test:competitor-fixes` | ✅ 13/13 |

## Route smoke (dev server)

| Route | HTTP |
|-------|------|
| `/` | ✅ 200 |
| `/setup` | ✅ 200 |
| `/integrations` | ✅ 200 |
| `/jobs` | ✅ 200 |
| `/apply` | ✅ 200 |
| `/track` | ✅ 200 |
| `/interview` | ✅ 200 |
| `/resume` | ✅ 200 |

## Feature paths (code verified)

| Feature | Status | Notes |
|---------|--------|-------|
| /integrations portal | ✅ | `test:integrations` 9/9; status API no leak |
| /setup wizard loads | ✅ | HTTP 200; link-out steps |
| Profile switcher | ✅ | `test:profiles` + shell component |
| Jobs discover path | ✅ | OSS + fixtures; `test:jobs` 34/34 |
| Apply REVIEW gate | ✅ | `test:apply` 58/58 |
| Gmail track (mock) | ✅ | `test:track` 69/69; fixture path |
| Interview fixture voice | ✅ | `test:voice` + `test:interview` |
| Security test:security | ✅ | 22/22 |
| No duplicate exports / dead code | ✅ | build + typecheck clean |
| Autopilot ensureBrief wired | ✅ | `test:autopilot` orchestrator chain |
| Gmail OAuth signed state (SEC-08) | ✅ | `test:autopilot` oauth state tests |

## Deferred (non-blocking)

| ID | Item |
|----|------|
| sec-01 | Read-only server action gates on LAN (mutations gated) |
| sec-10 | Deprecate `?token=` query param |
| sec-11 | Backup export default-deny on LAN |
| sec-14 | Pub/Sub OIDC on Gmail push |
| sec-16 | npm moderate advisories (next/postcss) |
| ux-pipeline-shell | Collapse legacy 16-item nav |
| ux-setup-wizard | Embed import/dictation/goals |
| ux-applying-split | Needs you / Running / Queued |
| p4-voice | Pipecat OSS runner |
| p5-apply | Full cooperative Playwright handoff |
| §13 competitive | Chrome clipper, PDF import, ATS dashboard |
