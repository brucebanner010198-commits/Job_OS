---
name: Job OS Master Execution Plan
status: ready-for-execution
repo: /Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS
updated: 2026-06-17
supersedes:
  - free_alternatives_research_54b785cd.plan.md
  - tts_evaluation_plan_ef01c5b9.plan.md
---

# Job OS — Master Execution Plan

**Use this document alone in a clean chat.** It consolidates integration strategy, full-automation vision, TTS evaluation, and phased implementation. Prior fragmented plans are superseded by this file.

---

## 0. How to execute (agent bootstrap)

```bash
cd /Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS
npm install
npm run db:up          # Postgres + pgvector via Docker
cp .env.example .env   # or use Integrations portal once Phase 1 ships
npm run db:generate && npm run db:migrate
npm run typecheck
npm run dev            # http://localhost:3000 (may use 3001 if 3000 busy)
```

**Verify baseline:** `npm run typecheck` and CI test scripts in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) must pass before/after each phase.

**User instruction to start:** *"Execute Phase 1 of `.cursor/plans/job_os_master_execution_plan.md`"* (then Phase 2, etc.).

---

## 1. Product vision

**Job OS** is a local-first AI job-search operating system: master resume → career goals → discover/score jobs → company briefs → tailor apply materials → apply → Gmail track → warm-path → interview prep.

### Target end state

| Human does once | AI runs unattended |
|-----------------|-------------------|
| Master resume (voice/import) | Discover + score jobs |
| Career goals | Company briefs (web research) |
| Application answers (work auth, salary, links) | Tailor resume + cover letter |
| Integrations keys (portal) | Prepare applications |
| | Auto-submit **AUTONOMOUS-route** jobs only |
| | Gmail sync + status **proposals** |
| | Study guides + follow-up drafts |
| | Interview prep suggestions |

| Human always | |
|--------------|--|
| Real employer interviews | |
| Confirm Gmail status moves (wrong label = worst bug) | |
| Approve **ASSISTED** / **MANUAL** apply submissions | |
| Send warm intros / follow-ups (drafts only from AI) | |

### Locked decisions (do not re-litigate without user)

| Decision | Choice |
|----------|--------|
| Primary LLM | **OpenRouter** (`lib/ai/openrouter.ts`) |
| Primary live voice | **ElevenLabs ConvAI** — two agents: AI_SCREEN + REAL_HR |
| OSS voice fallback | **Pipecat + faster-whisper + Kokoro + OpenRouter** (not raw HF TTS alone) |
| Company intel | **Web-research agent + primary sources** — **drop Crunchbase** |
| Job discovery default | OSS public APIs (Remotive + add RemoteOK, Arbeitnow, Jobicy) |
| Optional paid job API | JSearch via Integrations portal |
| Knowledge storage | In-app **Knowledge Notebook** (ProfileEntry + pgvector RAG) — not NotebookLM |
| Apply autopilot | Auto-submit **AUTONOMOUS** only; ASSISTED/MANUAL need human |
| Apply handoff | Cooperative Playwright (pause / user takeover / resume AI) — **not built** |
| Secrets UX | **Integrations portal** — paste keys in-app → keychain or `.secrets/keys.json` |
| Deployment default | Personal, local-first Mac; OSS license allowlist: Apache 2.0 / MIT / BSD only in ship bundle |

---

## 2. Stack and repo map

| Layer | Technology |
|-------|------------|
| App | Next.js 15, React 19, TypeScript, Tailwind v4 |
| DB | PostgreSQL + pgvector (Docker) |
| ORM | Prisma — [`prisma/schema.prisma`](prisma/schema.prisma) |
| AI | OpenRouter — [`lib/ai/openrouter.ts`](lib/ai/openrouter.ts), [`lib/ai/models.ts`](lib/ai/models.ts) |
| Embeddings | OpenRouter → pgvector — [`lib/ai/embeddings.ts`](lib/ai/embeddings.ts), [`lib/scoring/embedding-relevance.ts`](lib/scoring/embedding-relevance.ts) |
| Secrets | [`lib/secrets/index.ts`](lib/secrets/index.ts) — env read-only today; keychain on desktop |
| Module registry | [`lib/modules.ts`](lib/modules.ts) — `uiStatus` vs `liveStatus` |

### Adapter seams (extend here)

| Domain | Registry / seam | Add new work as |
|--------|-----------------|-----------------|
| Jobs | [`lib/jobs/sources/index.ts`](lib/jobs/sources/index.ts) | New `JobSource` file |
| Brief | [`lib/brief/sources.ts`](lib/brief/sources.ts) | New `BriefSource` adapter |
| Voice | [`lib/interview/index.ts`](lib/interview/index.ts) | New `VoiceSource` |
| Apply | [`lib/apply/driver.ts`](lib/apply/driver.ts) | Driver + state machine |
| AI | [`lib/ai/openrouter.ts`](lib/ai/openrouter.ts) | Provider abstraction if needed |

---

## 3. Built today vs missing

### Built (production UI + logic)

| Module | Key files | liveStatus |
|--------|-----------|------------|
| Master resume + voice dictation | `lib/profile/`, `app/(app)/master-resume/` | live |
| Career goals → scoring | `lib/goals/`, `lib/scoring/score.ts` | live |
| Job pipeline (filter, score, ingest) | `lib/jobs/`, Remotive source | partial |
| Company brief + citation guard | `lib/brief/`, official/news/wiki sources | partial |
| Tailor resume / cover letter | `lib/resume/tailor.ts`, `lib/coverletter/` | live (manual) |
| Apply brain + review gate | `lib/apply/engine.ts`, `components/apply/` | partial |
| Playwright driver | `lib/apply/driver-playwright.ts` | opt-in (`APPLY_DRIVER=playwright`) |
| Gmail track (propose-only) | `lib/gmail/`, `lib/track/` | partial |
| Interview STUDY mode | `lib/interview/study.ts` | live |
| Interview voice (ElevenLabs + fixture) | `lib/interview/voice-live.ts`, `voice-fixture.ts` | partial |
| Scheduler / catchup | `scripts/run-catchup.ts`, 3 job kinds | partial |
| Backups, outcomes, mobile nav | various | ready/partial |
| Auth middleware (non-localhost) | `middleware.ts`, `lib/auth/access.ts` | live |
| CI | `.github/workflows/ci.yml` | live |

### Not built (this plan)

| Gap | Phase |
|-----|-------|
| Integrations portal | 1 |
| `getSecret()` everywhere (voice, jsearch still use `process.env`) | 1 |
| Web-research brief agent + SEC EDGAR | 2 |
| OSS job sources (RemoteOK, Arbeitnow, Jobicy) | 2 |
| Knowledge Notebook RAG | 3 |
| Pipecat OSS voice runner | 4 |
| Cooperative Playwright handoff | 5 |
| Autopilot orchestrator + expanded catchup | 6 |
| Onboarding wizard | 6 |

### Apply: cooperative handoff status

**Built:** pre-submit review gate, headed Playwright, dry-run, CAPTCHA abort, MANUAL route.

**Not built:** mid-flow pause/resume, user takeover, long-lived browser session, live browser in UI, LLM essay fields, resume PDF attach in driver, CAPTCHA continue.

---

## 4. Integration policy

| Service | Role | Required? | Config |
|---------|------|-----------|--------|
| **OpenRouter** | All LLM + embeddings | Yes for AI features | `OPENROUTER_API_KEY` |
| **ElevenLabs** | AI_SCREEN + REAL_HR live voice | Optional (fixture fallback) | `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_AI_SCREEN`, `ELEVENLABS_AGENT_REAL_HR` |
| **Gmail OAuth** | Tracker sync | Optional | `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET` + Connect |
| **JSearch** | Broader job search | Optional paid | `JSEARCH_API_KEY` |
| **Remotive / OSS job APIs** | Default discovery | Free | `JOBS_FREE_SOURCES=1` |
| **SEC EDGAR** | US funding in briefs | Free | `SEC_EDGAR_USER_AGENT` (name+email) |
| **SearXNG** | Optional metasearch | Self-host | `SEARXNG_URL` |
| **Pipecat runner** | OSS voice fallback | Optional | `PIPECAT_CONNECT_URL` |
| **Crunchbase** | **Removed** — do not add to portal | — | — |

**Crunchbase rationale:** Aggregator of public data; web-research + EDGAR + existing sources produce **more defensible cited briefs**. Remove from default [`lib/brief/sources.ts`](lib/brief/sources.ts) pipeline in Phase 2.

---

## 5. Voice / TTS evaluation (summary)

Job OS needs a **conversational voice agent** (STT + turn-taking + TTS + WebRTC), not TTS alone.

### Recommendation: hybrid dual-stack

```
elevenlabs (if keyed) → local-pipecat (if PIPECAT_CONNECT_URL) → fixture mock
```

| Option | Verdict | Why |
|--------|---------|-----|
| **ElevenLabs ConvAI** | **Primary** | Built; full agent; two personas; WebRTC signed URL |
| **Pipecat + Whisper + Kokoro + OpenRouter** | **OSS fallback** | Apache/MIT; seam exists; cost control |
| **Kokoro-82M** | TTS in OSS stack | Apache 2.0; Pipecat native |
| **Fish Audio S2 Pro** | Optional eval only | Strong emotion tags; **commercial license required**; 4B GPU |
| **Coqui XTTS-v2** | **Do not ship** | CPML non-commercial only |
| **Raw HF TTS swap** | **Invalid** | Missing STT, orchestration, WebRTC |

### Voice stress-test pass/fail

| ID | Criteria |
|----|----------|
| S1 | No keys → fixture mock full flow |
| S1b | Portal keys only → live ElevenLabs works |
| S2 | ElevenLabs outage → fallback within 2s |
| S3 | Turn latency median <800ms (target <400ms) |
| S4 | AI_SCREEN vs REAL_HR blind test ≥4/5 correct |
| S5 | 30 min/session, 60 min/day caps enforced |
| S6 | OSS on CPU Mac: dev-only (TTFB <1.5s) |
| S7 | Ship bundle: Apache/MIT/BSD only |
| S8 | Sensitive profile facts never in voice prompts |

### ElevenLabs agent setup (for Integrations docs)

Mirror [`lib/interview/persona.ts`](lib/interview/persona.ts):

- **AI_SCREEN:** robotic, low warmth (0.15), structured screener → `ELEVENLABS_AGENT_AI_SCREEN`
- **REAL_HR:** warm, high warmth (0.85), hard follow-ups → `ELEVENLABS_AGENT_REAL_HR`

Cost caps: [`DEFAULT_VOICE_CAPS`](lib/interview/types.ts) — 30 min/session, 60 min/day.

---

## 6. Unified implementation phases

### Phase 1 — Integrations portal + secret unification (Weeks 1–2)

**Goal:** Paste OpenRouter, ElevenLabs, Gmail, JSearch keys in `/integrations`; keys work immediately.

| Task | Files to create/modify |
|------|------------------------|
| Writable file secret store | `lib/secrets/file-store.ts`, `lib/secrets/composite.ts` |
| Integration registry | `lib/integrations/registry.ts` |
| Portal page + actions | `app/(app)/integrations/page.tsx`, `app/actions/integrations.ts` |
| Status API (no secret leak) | `app/api/integrations/status/route.ts` |
| Nav link | `components/app-shell.tsx` |
| Unify secret reads | `lib/interview/voice-live.ts`, `lib/jobs/sources/jsearch.ts`, `lib/interview/voice-cartesia.ts` — use `getSecret()` |
| Module entry | `lib/modules.ts` |
| Env template | `.env.example` — document portal as primary path |
| Tests | `scripts/test-integrations.ts`, wire in CI |

**Acceptance:**
- Save `OPENROUTER_API_KEY` in portal → brief/resume AI works without `.env` edit
- Save ElevenLabs key + 2 agent IDs → AI_SCREEN live session starts
- Gmail OAuth from portal (move copy from `/track`)
- `npm run test:voice` + new integration tests pass
- Desktop: `JOB_OS_DESKTOP=1` writes to keychain via existing [`lib/secrets/keychain.ts`](lib/secrets/keychain.ts)

---

### Phase 2 — Data layer: web research, EDGAR, OSS jobs (Weeks 3–4)

**Goal:** Replace Crunchbase; broaden free job discovery.

| Task | Files |
|------|-------|
| Web-research brief adapter | `lib/brief/source-web-research.ts` |
| SEC EDGAR Form D adapter | `lib/brief/source-edgar.ts` |
| Wikidata SPARQL (optional) | `lib/brief/source-wikidata.ts` |
| Remove Crunchbase from default pipeline | `lib/brief/sources.ts` — keep adapter file for tests only or delete |
| Job sources | `lib/jobs/sources/remoteok.ts`, `arbeitnow.ts`, `jobicy.ts` + register in `index.ts` |
| Tests | `scripts/test-brief-web-research.ts`, extend `scripts/test-jobs-sources.ts` |
| Integrations toggles | Per-source enable in registry |

**Web-research agent design:**
1. Seed URLs: company domain, `/about`, `/careers`, Google News, Wikipedia, EDGAR
2. Fetch via [`lib/brief/fetch-utils.ts`](lib/brief/fetch-utils.ts)
3. OpenRouter `MODEL_CHEAP` — extract **quoted passages only** with URL
4. Optional SearXNG at `SEARXNG_URL`
5. Never scrape gated sites (Crunchbase paywall)
6. Cache in `CompanyBrief`

**Acceptance:**
- Brief for test company has ≥2 independent primary sources
- Crunchbase not called when key absent (and removed from default)
- RemoteOK + Arbeitnow return jobs in discovery run
- `npm run test:brief` + `test:jobs` pass

---

### Phase 3 — Knowledge Notebook (Weeks 5–6)

**Goal:** RAG over profile, briefs, JDs for apply, letters, interview.

| Task | Files |
|------|-------|
| Embedding index service | `lib/knowledge/index.ts`, `lib/knowledge/retrieve.ts` |
| Prisma model or extend `TextEmbedding` | migration if needed |
| Wire into apply field gen (Phase 5) and study | consumers |
| Integrations toggle | registry |
| Tests | `scripts/test-knowledge.ts` |

**Scope (Tier 1):** ProfileEntry, ProfileNote, CompanyBrief claims, Job descriptions, ApplicationAnswers history.

**Not in scope:** Google NotebookLM; optional Tier 2 Open Notebook sidecar later.

**Acceptance:**
- Retrieve top-k chunks for a job JD + company name
- Study mode can optionally pull notebook context (still extractive-only)

---

### Phase 4 — OSS voice runner + ElevenLabs hardening (Weeks 5–7, parallel with 3)

**Goal:** Pipecat fallback; ElevenLabs production path via portal.

| Task | Files |
|------|-------|
| Docker/sidecar | `docker-compose.voice.yml` or `scripts/pipecat-runner/` |
| Local voice adapter | `lib/interview/voice-local.ts` |
| Provider order update | `lib/interview/index.ts` — `elevenlabs → local → fixture` |
| Benchmark script | `scripts/benchmark-voice.ts` |
| Fallback on grant failure | voice-live + index |

**OSS stack:** Pipecat + SmallWebRTC + faster-whisper + KokoroTTS + OpenRouter LLM; POST body includes `systemPrompt`, `opener`, `warmth` from [`persona.ts`](lib/interview/persona.ts).

**Acceptance:**
- S1–S5 voice stress tests pass
- OSS runner documented in Integrations portal
- Fish S2 Pro: **no production dependency** unless commercial license obtained (optional benchmark only)

---

### Phase 5 — Cooperative apply + LLM fields (Weeks 8–10)

**Goal:** User can watch, take control, return control; LLM fills essays.

| Task | Files |
|------|-------|
| Playwright session service (long-lived) | `lib/apply/session-service.ts` |
| States PAUSED / HANDOFF | `lib/apply/state-machine.ts`, `lib/apply/types.ts` |
| UI controls | `components/apply/apply-workspace.tsx` |
| LLM field generation | `lib/apply/fields-llm.ts` — grounded via Knowledge Notebook |
| Wire tailor resume PDF into prepare | `lib/apply/service.ts` + driver upload |
| API routes for session control | `app/api/apply/session/` |
| Tests | extend `scripts/test-apply.ts`, `test-apply-driver.ts` |

**Acceptance:**
- User clicks "Take control" → automation pauses → user acts → "Resume AI" continues
- CAPTCHA detected → pause (not FAIL) → user solves → resume
- Essay fields generated from profile facts only (provenance check)

---

### Phase 6 — Autopilot orchestrator (Weeks 11–13)

**Goal:** Chain discover → brief → tailor → prepare → apply (AUTONOMOUS only).

| Task | Files |
|------|-------|
| Orchestrator service | `lib/autopilot/orchestrator.ts`, `lib/autopilot/policy.ts` |
| Catchup jobs | extend `lib/scheduler/types.ts`, `scripts/run-catchup.ts` |
| Goal-aware discovery queries | use `lib/goals/service.ts` not just `JOBS_DEFAULT_QUERY` |
| Onboarding wizard | `app/(app)/onboarding/page.tsx` |
| Dashboard autopilot status | `app/(app)/page.tsx` |
| Tests | `scripts/test-autopilot.ts` |

**Policy (locked):**
- Auto-submit: `AUTONOMOUS` route only ([`lib/apply/router.ts`](lib/apply/router.ts))
- ASSISTED / MANUAL: human approve before submit
- Gmail: propose only (unchanged)
- Warm intros / follow-ups: draft only

**Acceptance:**
- Catchup run: discover → score → brief top N → prepare → auto-submit AUTONOMOUS apps
- ASSISTED jobs stop at REVIEW with notification
- Onboarding completes profile + goals + answers + integrations in one flow

---

## 7. Stress-test matrix (full plan)

| Area | Scenario | Pass | Fail action |
|------|----------|------|-------------|
| Secrets | Portal save → immediate use | getSecret resolves | Fix composite store order |
| Brief | Single-source claim | Guard refuses "verified" | Expected |
| Brief | Web research + news | "verified" status | Fix adapter |
| Jobs | No JSearch key | OSS sources return jobs | Fix adapters |
| Voice | No ElevenLabs | Fixture or OSS | Degrade chain |
| Apply | AUTONOMOUS + clean page | Auto-submit | Fix orchestrator |
| Apply | ASSISTED | Stops at REVIEW | Expected |
| Apply | CAPTCHA mid-flow | Pause not fail | Phase 5 |
| Track | Gmail proposal | Human confirm required | Expected |
| Cost | 61st minute voice | Blocked | guard.ts |
| CI | All test scripts | Green | Fix regression |

---

## 8. Risk register

| Risk | Mitigation |
|------|------------|
| ElevenLabs cost | Session/daily caps; OSS fallback for practice |
| OSS voice latency on CPU | Label dev-only; ElevenLabs for production mocks |
| Web research ToS / rate limits | robots.txt, caching, SEC User-Agent |
| License (Fish S2, XTTS) | Allowlist Kokoro/Whisper/Pipecat only |
| Autopilot wrong submit | AUTONOMOUS gate + live scan before submit |
| Secret leak in client | Server-only grant; status API never returns values |
| pgvector dim change | Stay on OpenRouter 1536-dim; no Ollama migration unless requested |

---

## 9. Verification commands (after each phase)

```bash
npm run typecheck
npm run test:provenance && npm run test:goals && npm run test:scoring
npm run test:jobs && npm run test:brief
npm run test:apply && npm run test:apply-driver
npm run test:interview && npm run test:voice
npm run test:track && npm run test:warm
# Phase-specific:
# npm run test:integrations   (Phase 1)
# npm run test:knowledge      (Phase 3)
# npm run test:autopilot      (Phase 6)
```

---

## 10. Execution todos (track in clean chat)

| ID | Phase | Task | Status |
|----|-------|------|--------|
| p1-portal | 1 | Integrations portal + composite secrets + getSecret unification | pending |
| p2-brief-jobs | 2 | Web-research + EDGAR + OSS job sources; drop Crunchbase default | pending |
| p3-notebook | 3 | Knowledge Notebook RAG | pending |
| p4-voice | 4 | Pipecat OSS runner + ElevenLabs fallback chain | pending |
| p5-apply | 5 | Cooperative Playwright + LLM fields + resume attach | pending |
| p6-autopilot | 6 | Orchestrator + catchup + onboarding + AUTONOMOUS-only submit | pending |

---

## 11. Out of scope (unless user requests)

- Replacing OpenRouter with Ollama as default
- Replacing ElevenLabs entirely
- Crunchbase re-integration
- Auto-confirm Gmail status changes
- Auto-send emails / LinkedIn messages
- Bundled Node for Tauri (separate track in `src-tauri/`)
- PDF/DOCX import (nice-to-have in onboarding)

---

## 12. Conflicts resolved

| Conflict | Resolution |
|----------|--------------|
| OSS-first vs keep ElevenLabs/OpenRouter | OSS for **data** (jobs, briefs); **keep** OpenRouter + ElevenLabs for AI/voice quality |
| Full autopilot vs "human approves" README | Tiered: auto everything except ASSISTED/MANUAL submit, Gmail confirm, outbound send |
| Fish S2 vs Kokoro | Kokoro in ship bundle; Fish S2 eval only with commercial license |
| NotebookLM vs in-app RAG | In-app Knowledge Notebook (Tier 1) |

**Plan status: COMPLETE — ready for phased execution starting at Phase 1.**

---

## 13. Competitive enhancement backlog (verified)

Verified 2026-06-18 by judgment agent. Full analysis: [`.cursor/plans/job_os_competitive_enhancement_plan.md`](.cursor/plans/job_os_competitive_enhancement_plan.md). Reconciled 2026-06-18 with [`.cursor/plans/competitive_landscape_research.md`](.cursor/plans/competitive_landscape_research.md) — research-only rows marked below.

| ID | Phase | Task | Status | Source |
|----|-------|------|--------|--------|
| p2-brief-legitimacy | 2 | Posting-legitimacy signals in web-research brief (ghost job, stale repost, thin JD) | pending | judgment agent |
| p3-ats-keywords | 3 | Keyword-gap retrieval in Knowledge Notebook for tailor + match UI | pending | judgment agent |
| p7-ats-score | 7 | ATS match score dashboard per job (%, gaps, suggestions) | pending | judgment agent |
| p7-ats-detect | 7 | ATS platform detection from job URL/domain | pending | judgment agent |
| p7-apply-coverage | 7 | CI matrix: apply driver pass rate per ATS family | pending | judgment agent |
| p7-warm-path-live | 7 | Warm-path live adapters beyond fixture (import, intro drafts) | pending | judgment agent |
| p7-linkedin-live | 7 | LinkedIn profile audit module wired live | pending | judgment agent |
| p7-chrome-clipper | 7 | Optional Chrome extension: clip job → ingest API | pending | judgment agent |
| p7-import-resume | 7 | PDF/DOCX import → ProfileEntry with provenance | pending | judgment agent |
| p7-onboarding-polish | 6 | Onboarding: import + first match score + competitive empty states | pending | judgment agent |
| p2-portal-scanner | 2b | Zero-token GH/Ashby/Lever portal scanners (`lib/jobs/sources/greenhouse.ts`, `ashby.ts`, `lever.ts`) | pending | research agent |
| p5-apply-telemetry | 5b | Local apply session metrics: submitted / paused / failed by route + dashboard widget | pending | research agent |
| p7-import-external | 7 | reactive-resume JSON + Career Ops eval YAML import | pending | research agent |

---

## 14. Security hardening backlog

From [`.cursor/plans/security_red_team_assessment.md`](.cursor/plans/security_red_team_assessment.md) (2026-06-18 red-team pass).

| ID | Sev | Task | Status |
|----|-----|------|--------|
| sec-01 | Critical | Gate server actions when non-localhost + `JOB_OS_ACCESS_TOKEN` set | done |
| sec-06 | High | Scope Knowledge Notebook to `profileId` (index + retrieve + schema) | done |
| sec-07 | High | Scope interview `loadFacts` to active profile | done |
| sec-08 | Medium | Gmail OAuth signed `state` cookie (CSRF on connect) | pending |
| sec-10 | Medium | Deprecate `?token=` access param; document Bearer-only for prod | pending |
| sec-11 | Medium | Default-deny or document `/api/backup/export` on LAN exposure | pending |
| sec-12 | Medium | Fix apply session API to use `getAppContext().scope` | done |
| sec-13 | Medium | Document `.secrets/` sync exclusion + FileVault requirement | pending |
| sec-14 | Low | Optional Pub/Sub OIDC verification on Gmail push webhook | pending |
| sec-16 | Low | Resolve `next` / `postcss` moderate npm advisories | pending |
| sec-ci | Info | Wire `npm run test:security` + `npm audit --audit-level=high` into CI | pending |

**Applied in assessment pass:** SSRF URL guard (`lib/security/url.ts`), Playwright URL guard, auth middleware expansion, timing-safe token compare, null-Host bypass fix, `test:security` gate.

**Applied 2026-06-18 (post–AppScope migration):** `requireAccessForMutation` on all mutating server actions, middleware access-cookie bootstrap, knowledge/interview profile scoping verified, apply session API uses `getAppContext().scope`.

---

## 15. UX consolidation backlog

From [`.cursor/plans/ux_flow_consolidation_plan.md`](.cursor/plans/ux_flow_consolidation_plan.md) (2026-06-18 UX audit). Presentation-layer consolidation; preserves locked AUTONOMOUS-only submit and Gmail propose-only.

| ID | Phase | Task | Status |
|----|-------|------|--------|
| ux-pipeline-shell | 6 | Pipeline layout + 6-stage nav in `app-shell.tsx`; legacy route redirects | pending |
| ux-setup-wizard | 6 | `/pipeline/setup` — 3-step wizard (import + dictation + goals); `lib/pipeline/setup-status.ts` | pending |
| ux-autopilot-trigger | 6 | `onSetupComplete` → enqueue discover-jobs + autopilot-cycle catchup | pending |
| ux-route-badges | 6 | Shared `route-badge` on job cards; `lib/pipeline/route-preview.ts` | pending |
| ux-applying-split | 5–6 | `/pipeline/applying` — Needs you / Running / Queued; embed apply-workspace | pending |
| ux-applied-stage | 6 | `/pipeline/applied` — inbox proposals + Applied column compose | pending |
| ux-orchestrator-brief | 6 | Wire `ensureBrief` into `runAutopilotCycle` before prepare (honest autopilot chain) | done |
| ux-interview-checklist | 8 | Readiness checklist before voice; relocate interview board to pipeline stage | pending |
| ux-questionnaire-gate | 8 | `lib/interview/questionnaire.ts` + hard gate before AI_SCREEN / REAL_HR | pending |
| ux-rejection-learning | 6–7 | `lib/track/rejection-learning.ts` — on REJECTED confirm, feed Outcome learnings | pending |
| ux-outcome-stage | 6 | `/pipeline/outcome` — KPI strip + offers/rejections/learnings feed | pending |
| ux-settings-drawer | 6 | Collapse Integrations, Backups, LinkedIn, Warm-path, Boosters into settings overlay | pending |
| ux-dashboard-redirect | 6 | `/` → setup-gated pipeline home; demote module grid | pending |
| ux-gmail-auto-applied | 7 | Optional hybrid: auto-confirm APPLICATION_RECEIVED → APPLIED only (low-risk) | pending |
| ux-goals-voice-agent | 4–6 | Multi-turn conversational goals (beyond VoiceInput + synthesize) | pending |

---

## 16. Competitor-inspired fixes

From [`.cursor/plans/competitor_fault_fixes_report.md`](.cursor/plans/competitor_fault_fixes_report.md) (2026-06-18). Turns competitor weaknesses into Job OS strengths.

| ID | Task | Status |
|----|------|--------|
| cmp-route-badges | `routePreview` on `JobView` + `RouteBadge` on job queue cards | done |
| cmp-ats-match | Lexical ATS keyword match panel on job expand (`lib/scoring/ats-keywords.ts`) | done |
| cmp-rejection-learning | `lib/track/rejection-learning.ts` + hook on REJECTED `confirmProposal` | done |
| cmp-readiness-gate | `ReadinessGate` before voice modes (brief + study checklist) | done |
| cmp-local-first-badge | `LocalFirstBadge` + export CTA on dashboard | done |
| cmp-autopilot-policy | `AutopilotPolicyCallout` on apply page | done |
| cmp-cited-brief-badge | `CitedSourcesBadge` on company brief results | done |
| cmp-pipeline-stage | `PipelineStageBadge` on job cards (minimal) | done |
| cmp-full-os-home | Dashboard differentiator cards vs CLI/cloud/spray tools | done |
| cmp-tools-nav | Collapse secondary nav under Tools | done (polish agent — dashboard `All tools`) |
| cmp-questionnaire-gate | Hard questionnaire before REAL_HR | deferred |
| cmp-outcome-learnings-feed | Surface rejection notes on Outcome stage | deferred |
| cmp-knowledge-ats-wire | Wire keyword gaps to Knowledge Notebook RAG (`p3-ats-keywords`) | deferred |

---

## 17. Hire-probability & dual-audience backlog

From [`.cursor/plans/product_vision_hire_probability.md`](.cursor/plans/product_vision_hire_probability.md) (2026-06-18). Transform applicants into interview-earning candidates; optimize outputs for recruiter 6-second skim.

| ID | Task | Status |
|----|------|--------|
| hire-quality-gate | `lib/autopilot/quality-gate.ts` — block apply when screening/job score below threshold; env config | done |
| hire-failure-registry | `lib/candidate/failure-modes.ts` — signal → remediation catalog | done |
| hire-apply-readiness | Job card readiness badge (score, screening %, route, Ready/Fix first) | done |
| hire-recruiter-packet | `components/resume/recruiter-skim-view.tsx` — 6s fit packet + top-third highlight | done |
| hire-recruiter-summary | `lib/resume/recruiter-summary.ts` — 3-line fit statement from tailor | done |
| hire-outcome-loop | Rejection learning → ProfileNote + failure-mode profile fixes | done |
| hire-autopilot-gate | Wire quality gate into `runAutopilotCycle` before auto-submit | done |
| hire-test-gate | `npm run test:hire-probability` + CI wire | done |
| hire-tailored-gate | Pass post-tailor `screening.overall` into quality gate (not keyword proxy only) | pending |
| hire-daily-counter | Persist daily auto-submit count per profile (DB or local state) | pending |
| hire-readiness-tailor | Job card uses tailored screening when target exists for job | pending |
| hire-packet-pdf | Export recruiter packet as one-page PDF attachment | pending |
| hire-interview-kpi | Dashboard widget: interview rate + apply quality score trend | pending |
| hire-followup-loop | Rejection fixes → auto-suggest master profile bullet additions | pending |
| hire-env-docs | Document quality gate env vars in Integrations portal | pending |

---

## 17. Hire probability backlog

From [`.cursor/plans/product_vision_hire_probability.md`](.cursor/plans/product_vision_hire_probability.md) (when present). Cross-signal model: goals fit + ATS match + warm-path strength + brief quality → actionable hire probability per job.

| ID | Task | Status |
|----|------|--------|
| hire-model-spec | Document signals, weights, and ethical bounds for hire probability | pending |
| hire-score-lib | `lib/scoring/hire-probability.ts` — pure composite from existing scores | pending |
| hire-ui-badge | Hire probability badge on job queue cards | pending |
| hire-coach-wire | Low-probability jobs → coach note with gap + warm-path suggestions | pending |

---

## 18. Job training & HR connection backlog

From [`.cursor/plans/product_vision_job_training_package.md`](.cursor/plans/product_vision_job_training_package.md) (2026-06-18).

| ID | Task | Status |
|----|------|--------|
| train-dream-board | `lib/goals/dream-companies.ts` + goals UI dream company board | done |
| train-gap-analysis | `lib/candidate/gap-analysis.ts` — profile vs JD + brief gaps | done |
| train-rejection-explainer | `explainRejection()` categories + module fixes | done |
| train-hr-contacts | `lib/brief/hr-contacts.ts` — roles from brief/careers context | done |
| train-hub | `/training` hub linking setup, resume, cover, interview, warm-path | done |
| train-coach-notes | Rejection/gap fixes as `ProfileNote` source=`coach` | done |
| train-test-gate | `npm run test:job-training` validation script | done |
| train-hr-ui | HR contact hints panel on company brief workspace | pending |
| train-gap-ui | Gap analysis panel on job expand / apply prep | pending |
| train-brief-loop | Auto-suggest dream companies after goal save | pending |
| train-rejection-ui | Rejection explanation card on track confirm + outcomes feed | pending |
| train-f500-export | Block resume/cover export when critical standards fail | pending |
| train-warm-hr-merge | Merge HR hints with warm-path rank for outreach drafts | pending |
