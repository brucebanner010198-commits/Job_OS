# Overnight report (2026-09-23)

Branch: `feat/career-buddy-v1` (draft PR, not merged). Nothing was deleted; see `docs/PENDING-DELETIONS.md` for the things that need your OK.

## Start here

```bash
npm run jobos        # starts database, local AI, local speech, and the app
open http://127.0.0.1:3000
```

On a fresh machine run `npm run setup` once first. To use it from your phone on the LAN, set `JOB_OS_ACCESS_TOKEN` in `.env` and start with `JOBOS_HOST=0.0.0.0 npm run jobos`; the launcher refuses to serve on the network without a token.

## Why it wasn't working, and what changed

| Problem | Fix | Proof |
|---|---|---|
| Every AI call failed: the saved Ollama URL lacked `/v1`, and the app asked for a model (`llama3.2`) that wasn't installed | New router talks to Ollama's native API, normalizes the URL, and picks an installed model. Installed `gemma4:12b` (default) and `qwen3.5:9b` | Live call returned "ok" via `gemma4:12b`; `test:ai-routing` 20/20 |
| Browser Use apply and QA used a dead key from `.env` (401 "User not found") | Scripts get keys only from the app's secret store; run on the local model by default | `.env` key: HTTP 401, stored key: HTTP 200 (checked with curl) |
| Simulated and dry-run applications were recorded as APPLIED | Drivers report `submitted`, `stopped_at_review` or `failed`. Only a real submit marks APPLIED; otherwise you confirm it | `test:apply` 60/60, `test:apply-state` 45/45 |
| Your name, email and phone were hardcoded as fallbacks in a public repo | Removed from code; unknown answers stay blank and are reported, never guessed | Old commits still contain them (your call: no history rewrite) |
| Tests wrote fake data (Jane Doe, Acme Corp, a mock AWS certificate) into your real profile | DB tests now use a separate `jobos_test` database | Real profile stayed at 28 entries through 6 DB test runs |
| Your CV import produced junk ("& Training . . . 10") because AI was broken and the fallback parser ran | Import drops table-of-contents lines, splits long CVs, copies text verbatim, saves per section, and runs long CVs in the background | Your 58,665-char CV splits into 13 sections; re-import is listed in PENDING-DELETIONS |
| Journal bullets never showed on the resume; voice sessions wrote to it unreviewed and twice | Approved bullets attach to the matching job (or skills); voice sessions create drafts for approval | `test:career-journal` now checks the bullet appears where the page renders it |
| Voice went to Google's servers (browser speech API); uploaded audio was never transcribed | Local Parakeet speech service; recording and uploads both transcribe on this Mac | `test:voice-local`: 9 s clip transcribed in 2.5 s |
| Search embeddings were cloud-only, and a key bug silently dropped most vectors | Local `nomic-embed-text`, nearest-neighbour search in Postgres, id collision fixed | 133 of 133 chunks embedded; related text 0.76 vs unrelated 0.69 |
| Fake jobs and fake emails mixed into real data | Samples are opt-in (`JOBS_USE_FIXTURES=1`, `GMAIL_USE_FIXTURES=1`) | Your database had 0 fake jobs (69 real ones) |
| 2,086 lint errors | All came from the Python venv; now ignored | `npm run lint`: 0 errors, 0 warnings |
| Postgres was reachable from your whole network with password `jobos` | Bound to 127.0.0.1 | `docker port jobos-db` → `127.0.0.1:5432` |

## Privacy you can check

Every model call, embedding and transcription is written to a new `PrivacyLedgerEntry` table: destination, size, local or not, never content. Private mode (the default) keeps everything on this Mac. Enhanced mode sends only the tasks you consent to (for example Gemini for applying) with contact details scrubbed; Gmail content never goes to a cloud model. The consent screen and the Settings view of the ledger are not built yet.

## Tests

All 44 registered test scripts pass (the two Browser Use scripts need a running app and are covered above). `test:e2e-journey` passes 10/10 but takes 6.5 minutes, because its resume-import step now runs on the real local model; my 5-minute cap cut it off in the full sweep and a rerun passed. Also green: `npx tsc --noEmit`, `npm run lint` (0/0) and `npm run build`. The app starts with `npm run jobos`, and `/`, `/journal`, `/master-resume`, `/jobs`, `/apply` and `/integrations` return 200 with no console errors on the two pages I screenshotted.

## Honest limits found tonight

1. **The local model can't drive a browser.** On a public test form, `gemma4:12b` read the page correctly and listed the 4 questions it had no answers for (it didn't guess), but it kept clicking instead of typing and reported "failed". Reliable applying in Private mode needs per-site form fillers (Greenhouse, Lever, Ashby), which the plan already calls for; Enhanced mode with Gemini is the AI fallback. That work is next.
2. **This Mac is short on memory while other apps are open.** macOS had swapped out 15 million pages; the local model ran at about 11 tokens a second. Closing Chrome and the IDE speeds everything up. A long CV import takes about 25 minutes.
3. **Not built yet** (still in the plan): the six-screen redesign, the consent and ledger screens, readiness scores and real course sources, the autonomy ladder and Pause, per-site apply adapters, the learning loop, a scheduled daily run, and an evaluation set. I kept tonight to fixing what was broken and closing the daily loop, per your "no over-engineering" note.

## Decisions I made, and why

- **Gemma 4 12B as the default local model** over Qwen 3.5 9B: on the same CV section Gemma finished sooner (124 s vs 140 s) because Qwen wrote 68% more output. I did not compare their accuracy; the evaluation set in the plan should settle that.
- **Embeddings always local**, even in Enhanced mode: cheap on-device, and no reason to send your resume out for them.
- **Import copies bullets verbatim**: rewriting during import makes the model write more (slower on this Mac) and risks changing facts; polishing stays a separate step you review.
- **The speech service is single-threaded**: MLX only runs on the thread that loaded the model; one user doesn't need more.
- **Production server, not dev mode**, for daily use: faster pages; `npm run build` passes.
