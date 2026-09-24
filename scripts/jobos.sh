#!/usr/bin/env bash
# Job OS launcher.
#   npm run setup   one-time: dependencies, database, local models, speech service
#   npm run jobos   daily: start everything and serve the app
set -euo pipefail
cd "$(dirname "$0")/.."

OLLAMA_URL="http://127.0.0.1:11434"
STT_URL="http://127.0.0.1:8765"
CHAT_MODEL="${JOBOS_CHAT_MODEL:-gemma4:12b}"
HOST="${JOBOS_HOST:-127.0.0.1}"
PORT="${JOBOS_PORT:-3000}"
mkdir -p .logs

say() { printf '\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
wait_for() { for _ in $(seq 1 "$2"); do curl -sf "$1" >/dev/null && return 0; sleep 1; done; return 1; }

start_database() {
  docker info >/dev/null 2>&1 || fail "Docker is not running. Open Docker Desktop and try again."
  docker compose up -d db >/dev/null
  for _ in $(seq 1 30); do
    [ "$(docker inspect -f '{{.State.Health.Status}}' jobos-db 2>/dev/null)" = healthy ] && break
    sleep 1
  done
  npx prisma migrate deploy >/dev/null
  say "✓ database"
}

start_ollama() {
  if ! curl -sf "$OLLAMA_URL/api/tags" >/dev/null; then
    command -v ollama >/dev/null || fail "Ollama is not installed: https://ollama.com/download"
    open -ga Ollama 2>/dev/null || (nohup ollama serve >.logs/ollama.log 2>&1 &)
    wait_for "$OLLAMA_URL/api/tags" 30 || fail "Ollama did not start."
  fi
  # Another Ollama (e.g. a Docker container) can answer on this port without
  # Job OS's models; that would silently fall back to a weaker model.
  curl -s "$OLLAMA_URL/api/tags" | grep -q "\"$CHAT_MODEL" ||
    fail "The Ollama on $OLLAMA_URL has no $CHAT_MODEL. Quit other Ollama containers on port 11434 and open the Ollama app, or run: npm run setup"
  say "✓ local AI (Ollama, $CHAT_MODEL)"
}

start_stt() {
  if ! curl -sf "$STT_URL/health" >/dev/null; then
    [ -x .venv-stt/bin/python ] || fail "Speech service not installed. Run: npm run setup"
    nohup .venv-stt/bin/python scripts/stt_server.py >.logs/stt.log 2>&1 &
    wait_for "$STT_URL/health" 120 || fail "Speech service did not start; see .logs/stt.log"
  fi
  say "✓ local speech-to-text"
}

setup() {
  command -v node >/dev/null || fail "Node.js 22+ is required."
  command -v ffmpeg >/dev/null || fail "ffmpeg is required: brew install ffmpeg"
  command -v uv >/dev/null || fail "uv is required: brew install uv"
  [ -f .env ] || cp .env.example .env
  npm install
  start_database
  start_ollama
  for m in "$CHAT_MODEL" nomic-embed-text; do
    curl -s "$OLLAMA_URL/api/tags" | grep -q "\"$m" || OLLAMA_HOST=127.0.0.1:11434 ollama pull "$m"
  done
  [ -x .venv-stt/bin/python ] || uv venv --python 3.12 .venv-stt -q
  uv pip install --python .venv-stt/bin/python -q -r requirements-stt.txt
  if [ ! -x .venv-browser-use/bin/python ]; then
    uv venv --python 3.12 .venv-browser-use -q
    uv pip install --python .venv-browser-use/bin/python -q -r requirements-browser-use.txt
  fi
  npm run build
  say "Setup complete. Start Job OS with: npm run jobos"
}

start() {
  if [ "$HOST" != 127.0.0.1 ] && [ "$HOST" != localhost ]; then
    # Serving on the network: require the access token so other devices on the
    # LAN cannot read or change your data.
    [ -n "${JOB_OS_ACCESS_TOKEN:-$(grep -s '^JOB_OS_ACCESS_TOKEN=.' .env | cut -d= -f2-)}" ] ||
      fail "Set JOB_OS_ACCESS_TOKEN in .env before serving on $HOST (e.g. openssl rand -hex 24)."
  fi
  start_database
  start_ollama
  start_stt
  # Rebuild when there is no build yet, or any source changed since the last one;
  # otherwise a restart would quietly serve old code.
  if [ ! -f .next-build/BUILD_ID ] ||
    [ -n "$(find app components lib proxy.ts next.config.ts package.json -newer .next-build/BUILD_ID -type f -print -quit 2>/dev/null)" ]; then
    npm run build
  fi
  say "Job OS → http://$HOST:$PORT"
  exec env BUILD=1 npx next start -H "$HOST" -p "$PORT"
}

case "${1:-start}" in
  setup) setup ;;
  start) start ;;
  *) fail "usage: scripts/jobos.sh [setup|start]" ;;
esac
