#!/usr/bin/env bash
# Production supervisor tick loop. Echoes prompts every 5 minutes for agent pickup.
# Start: nohup bash scripts/supervisor-loop.sh >> /tmp/jobos-supervisor-loop.log 2>&1 &
set -euo pipefail
cd "$(dirname "$0")/.."
echo "supervisor-loop started pid=$$ at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
while true; do
  sleep 300
  echo "AGENT_LOOP_TICK_PRODUCTION_SUPERVISOR {\"prompt\":\"Production supervisor tick: db up, migrate, typecheck, build, all test:*, curl localhost:3000 for Job OS content, fix failures, update supervisor_final_report.md. Stop loop only when READY FOR ACTUAL RUN. Repo: /Users/sj1136/Documents/06_Software_And_Code/Personal/Job_OS\"}"
done
