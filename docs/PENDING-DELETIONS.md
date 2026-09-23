# Pending deletions (need your OK)

Nothing on this list was deleted. Each item says what it is, why it should go, and the exact command.

## 1. Test data in your real profile

Tests used to write into your real database. They now use a separate `jobos_test` database, but the rows they left behind are still in your profile, along with table-of-contents lines that the old importer saved as resume entries.

- 3 certificates named "AWS Certified Solutions Architect" with the link `.../verification/mock-12345`
- 13 resume entries: "Jane Doe Senior Backend Engineer" summaries, "Acme Corp" roles, the sample AWS certificate entries, and lines like "& Training . . . . . 10"

To review the list, then delete:

```bash
docker exec jobos-db pg_dump -U jobos -d jobos -Fc > .backups/before-cleanup.dump
npx tsx scripts/cleanup-test-data.ts           # lists the rows, deletes nothing
npx tsx scripts/cleanup-test-data.ts --apply   # deletes exactly those rows
```

A full backup from before tonight's work is also at `.backups/pre-career-buddy-20260923-0037.dump`.

## 2. Re-import your CV (optional, recommended after item 1)

Your CV was imported while the AI was broken, so the crude fallback parser read it. Re-importing on the Import page now runs the local model section by section in the background. It takes about 25 minutes on this Mac for a 58,000-character CV, faster with other apps closed. It adds entries; it does not remove the old ones, so do item 1 first.

## 3. Duplicate journal entry on the second profile

Profile `prof_64d82c61eda896d00779` has the same "Optimized Redis cache layer" experience twice. That duplicate came from the old coaching path, which is now fixed. Delete one of the two on the Master Resume page if you want.

## 4. Two Ollama servers on one port

The Docker container `librarian_ollama` (from your librarian project) publishes port 11434, the same port as the Ollama app. "localhost" reaches the container (only `llama3.2:3b`), while Job OS now uses 127.0.0.1, which reaches the Ollama app with `gemma4:12b`. `npm run jobos` stops with a clear message if it lands on the wrong one. The clean fix is to move the librarian container to another port; I left it alone because it belongs to another project.

## 5. Files and code that could be removed

These have no effect on the running app. They're listed for a future cleanup pass rather than deleted tonight:

- `scripts/pipecat-runner/` and `docker-compose.voice.yml`: a 29-line mock voice server; real local speech now lives in `scripts/stt_server.py`
- `ui_blank_screen_fix.md` and the five `*.tsbuildinfo` files in the repo root
- `pdf-parse` in `package.json`: nothing imports it
- `langchain-openai` in `.venv-browser-use`: no longer used by the scripts
- `buildOnboardingGuide` in `lib/career/onboarding-guide.ts`: nothing calls it
- The legacy `embedding` (1536-d) column on `TextEmbedding`: nothing writes it now; dropping it needs a migration
- `EMBEDDING_MODEL=openai/text-embedding-3-small` and the dead `OPENROUTER_API_KEY` in `.env`: the app ignores both now; the working key lives in `.secrets/keys.json`
