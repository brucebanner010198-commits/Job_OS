#!/usr/bin/env python3
"""
scripts/qa_with_browser_use.py

Visual smoke test of the running Job OS UI with a Browser Use agent. Each page
check is reported separately, and the run passes only if every check passes.
Runs on the local model by default, so no API key is needed.

Usage: npm run test:browser-use [-- --base-url http://127.0.0.1:3000 --no-headless]
"""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

project_root = Path(__file__).resolve().parent.parent
venv_python = project_root / ".venv-browser-use" / "bin" / "python"
if venv_python.exists() and Path(sys.executable).resolve() != venv_python.resolve():
    os.execl(str(venv_python), str(venv_python), *sys.argv)

sys.path.insert(0, str(Path(__file__).resolve().parent))
from browser_use_llm import add_llm_args, agent_speed_kwargs, build_llm, real_errors  # noqa: E402

# (path, what must be visible). Keep these in step with the app's screens.
CHECKS = [
    ("/", "the dashboard renders with navigation and no error message"),
    ("/import", "a resume upload area renders"),
    ("/master-resume", "the master resume page renders (entries or an empty state)"),
    ("/jobs", "the job queue renders (job cards or an empty state)"),
    ("/api/health", "a JSON response is shown"),
]


def parse_args():
    parser = argparse.ArgumentParser(description="Visual UI smoke test with Browser Use")
    parser.add_argument("--base-url", default=os.getenv("APP_URL", "http://127.0.0.1:3000"))
    parser.add_argument("--headless", action=argparse.BooleanOptionalAction, default=True)
    parser.add_argument("--output-dir", default=".logs/browser-use-qa")
    add_llm_args(parser)
    return parser.parse_args()


def write_report(out_dir, report):
    (out_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return report["ok"]


async def run(args):
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    started = time.time()

    llm, llm_error = build_llm(args)
    if llm_error:
        return write_report(out_dir, {"ok": False, "summary": llm_error, "checks": []})

    try:
        from browser_use import Agent
        from browser_use.browser.profile import BrowserProfile
        from pydantic import BaseModel
    except ImportError as exc:
        return write_report(out_dir, {"ok": False, "summary": f"Dependencies missing: {exc}", "checks": []})

    class CheckResult(BaseModel):
        path: str
        passed: bool
        observed: str
        error_text: Optional[str] = None

    class QaReport(BaseModel):
        checks: list[CheckResult]

    base = args.base_url.rstrip("/")
    steps = "\n".join(f"{i}. Open {base}{path} and check that {expect}." for i, (path, expect) in enumerate(CHECKS, 1))
    task = f"""You are testing a web app. Do each step in order:
{steps}

For every step record path, passed, a one-sentence description of what you saw, and any error text on the page.
Report a step as failed if the page shows an error, a blank screen or does not match."""

    gif_path = str(out_dir / "qa_actions.gif")
    agent = Agent(
        task=task,
        llm=llm,
        browser_profile=BrowserProfile(headless=args.headless),
        use_vision=True,
        generate_gif=gif_path,
        output_model_schema=QaReport,
        **agent_speed_kwargs(args),
    )

    try:
        history = await agent.run(max_steps=25)
    except Exception as err:  # the agent library raises many types
        return write_report(out_dir, {
            "ok": False,
            "durationSeconds": round(time.time() - started, 2),
            "summary": f"Agent crashed: {err}",
            "checks": [],
        })

    report = history.structured_output
    checks = [c.model_dump() for c in report.checks] if report else []
    failed = [c for c in checks if not c["passed"]]
    ok = bool(checks) and len(checks) == len(CHECKS) and not failed
    if not checks:
        summary = "The agent returned no check results."
    elif failed:
        summary = f"{len(failed)} of {len(checks)} checks failed."
    elif len(checks) != len(CHECKS):
        summary = f"Only {len(checks)} of {len(CHECKS)} checks were reported."
    else:
        summary = f"All {len(checks)} checks passed."

    return write_report(out_dir, {
        "ok": ok,
        "summary": summary,
        "provider": args.provider,
        "durationSeconds": round(time.time() - started, 2),
        "steps": history.number_of_steps(),
        "checks": checks,
        "agentErrors": real_errors(history),
        "gifPath": gif_path if os.path.exists(gif_path) else None,
    })


def main():
    sys.exit(0 if asyncio.run(run(parse_args())) else 1)


if __name__ == "__main__":
    main()
