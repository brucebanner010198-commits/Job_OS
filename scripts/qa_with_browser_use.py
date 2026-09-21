#!/usr/bin/env python3
"""
scripts/qa_with_browser_use.py

Automated web UI test runner using Browser Use.
Autonomously exercises Job OS routes, captures step screenshots,
and produces a structured verification report.
"""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def parse_args():
    parser = argparse.ArgumentParser(
        description="Automated web UI test runner with Browser Use"
    )
    parser.add_argument(
        "--base-url",
        default=os.getenv("APP_URL", "http://localhost:3000"),
        help="Base URL of Job OS web application",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("MODEL_STANDARD", "google/gemini-2.5-flash"),
        help="OpenRouter model slug to use for visual verification",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run browser in headless mode",
    )
    parser.add_argument(
        "--output-dir",
        default=".logs/browser-use-qa",
        help="Directory to save test reports and screenshots",
    )
    return parser.parse_args()


async def run_qa_suite(args):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        print(json.dumps({
            "ok": False,
            "error": "OPENROUTER_API_KEY is not configured in the environment.",
            "tests": []
        }, indent=2))
        return False

    try:
        from browser_use import Agent
        from browser_use.browser.profile import BrowserProfile
        try:
            from browser_use.llm.openai.chat import ChatOpenAI
        except ImportError:
            from langchain_openai import ChatOpenAI
    except ImportError as exc:
        print(json.dumps({
            "ok": False,
            "error": f"Browser Use dependencies missing: {exc}",
            "tests": []
        }, indent=2))
        return False

    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    gif_path = str(out_dir / "qa_actions.gif")
    base_url = args.base_url.rstrip("/")

    task = f"""
You are a QA automation engineer verifying the Job OS web application running at {base_url}.
Perform the following verification steps in sequence:

1. Navigate to {base_url}/import. Verify that the resume upload area and ATS ingestion UI render properly without crashing.
2. Navigate to {base_url}/master-resume. Verify that the candidate profile, contact information, and metric density sections appear on the page.
3. Navigate to {base_url}/jobs. Verify that the ranked job queue renders with job cards and match score badges.
4. Navigate to {base_url}/track. Verify that the Kanban application stages (Saved, Applied, Interviewing, Offer) render.
5. Navigate to {base_url}/api/diagnostics. Verify that the API returns a JSON response indicating the system is healthy.

After completing these checks, declare 'All verification steps completed successfully.' or report any specific failures encountered.
"""

    llm = ChatOpenAI(
        model=args.model,
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
        temperature=0.0,
    )

    browser_profile = BrowserProfile(
        headless=args.headless,
    )

    agent = Agent(
        task=task,
        llm=llm,
        browser_profile=browser_profile,
        generate_gif=gif_path,
        use_vision=True,
    )

    start_time = time.time()
    try:
        history = await agent.run(max_steps=25)
        duration = round(time.time() - start_time, 2)
        final_result = history.final_result() or "QA completed."

        steps_count = (
            history.number_of_steps()
            if hasattr(history, "number_of_steps")
            else len(history.agent_steps())
            if callable(getattr(history, "agent_steps", None))
            else len(history.agent_steps)
        )

        has_errors = bool(history.errors()) or not history.is_successful() if hasattr(history, "is_successful") else bool(history.errors())

        report = {
            "ok": not has_errors,
            "durationSeconds": duration,
            "actions": history.action_names(),
            "steps": steps_count,
            "errors": history.errors(),
            "summary": final_result,
            "gifPath": gif_path if os.path.exists(gif_path) else None,
        }

        report_file = out_dir / "report.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)

        print(json.dumps(report, indent=2))
        return report["ok"]
    except Exception as err:
        report = {
            "ok": False,
            "durationSeconds": round(time.time() - start_time, 2),
            "error": str(err),
            "summary": "QA execution failed due to an uncaught exception.",
        }
        report_file = out_dir / "report.json"
        with open(report_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(json.dumps(report, indent=2))
        return False


def main():
    args = parse_args()
    success = asyncio.run(run_qa_suite(args))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
