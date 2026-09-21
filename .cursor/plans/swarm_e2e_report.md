---
name: Swarm E2E Journey Report
generated: 2026-09-21T17:13:12.350Z
db_available: true
---

# Swarm E2E Journey Report

**Summary:** 9 passed, 1 failed, 0 skipped (of 10 steps)

## Results

| Step | Journey | Status | Mode | Notes |
|------|---------|--------|------|-------|
| 1 | Upload/import master resume → ProfileEntry populated | PASS | live | live importResumeText added 4 entries; kinds: CONTACT, SUMMARY, EXPERIENCE, SKILL |
| 2 | Voice dictation updates resume | PASS | fixture | live dictation failed: Local Ollama error (404): {"error":{"message":"model 'llama3.2' not found","type":"api_error","param":null,"code":null}}
; fixture dictation achievement entry added |
| 3 | Career goals saved → scoring uses goals | FAIL | live | saved northStar: VP of Engineering; EM job relevance manager=0.875 ml=0.750; queue top: no-goals=Product Manager, Platform / with-goals=Product Manager, Platform |
| 4 | Job discovery (OSS sources) → scored queue | PASS | live | offline preview queue: 13 jobs; filtered audit: 6; DB ingest: 28 raw, 18 kept, queue=39; top job: Senior Golang Developer @ Lemon.io score=0.6062500000000001 |
| 5 | Company brief generated with citations | PASS | offline | claims=10, refused=2; verified claims=7 |
| 6 | Tailor resume + cover letter for a job | PASS | fixture | resume provenance ok=true, cover provenance ok=true; saved resumeVersion=cmubi7iv… coverLetter=cmubi7iv… |
| 7 | Apply prepare → REVIEW gate → route tags | PASS | offline | greenhouse plan: route=ASSISTED nextState=REVIEW; linkedin plan: route=MANUAL; queue routePreview for greenhouse job: ASSISTED; canSubmit(REVIEW)=true |
| 8 | Gmail proposal flow (mock if no OAuth) | PASS | fixture | source=fixture live=false; emails=14, proposals=7; track preview proposals=7 |
| 9 | Study guide + interview voice fixture session | PASS | fixture | preps=3, questions=5; voice provider=fixture, grant.mock turns=7; provenanceOk=true |
| 10 | Multi-profile isolation smoke | PASS | live | profile A marker=true, profile B marker=true, cross-leak=false |

## Fixes needed

- **Step 3** (Career goals saved → scoring uses goals): saved northStar: VP of Engineering; EM job relevance manager=0.875 ml=0.750; queue top: no-goals=Product Manager, Platform / with-goals=Product Manager, Platform

## Known gaps (non-blocking)

- **Step 1–2**: Live LLM extraction (`importResumeText`, `extractFromDictation`) not exercised when OpenRouter key is missing/invalid; fixture seed validates DB persistence only.
- **Step 6**: Uses hand-crafted resume + provenance audit, not `tailorResume()` / `generateCoverLetter()` LLM paths.
- **Step 8**: Gmail runs on fixture corpus; live OAuth sync not validated in this gate.
- **Step 9**: Voice session uses fixture `MOCK_SCRIPT`; ElevenLabs/Pipecat live grants not validated.

## Run

```bash
npm run test:e2e-journey
```
