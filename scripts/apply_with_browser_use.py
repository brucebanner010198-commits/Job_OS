#!/usr/bin/env python3
"""
scripts/apply_with_browser_use.py

Autonomous job application driver using Browser Use and OpenRouter.
Visually navigates job application portals, completes candidate fields,
attaches resume files, and pauses at final review during dry runs.
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

# Automatically restart using the isolated virtual environment if it exists
project_root = Path(__file__).resolve().parent.parent
venv_python = project_root / ".venv-browser-use" / "bin" / "python"
if venv_python.exists() and Path(sys.executable).resolve() != venv_python.resolve():
    os.execl(str(venv_python), str(venv_python), *sys.argv)


try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


def parse_args():
    parser = argparse.ArgumentParser(
        description="Autonomous job application runner with Browser Use"
    )
    parser.add_argument("--url", required=True, help="Job application URL")
    parser.add_argument(
        "--candidate-json",
        required=True,
        help="Path to JSON file containing candidate profile data",
    )
    parser.add_argument(
        "--resume",
        required=False,
        default=None,
        help="Absolute path to candidate resume PDF",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Fill form and pause at final review screen without submitting",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("MODEL_STANDARD", "google/gemini-2.5-flash"),
        help="OpenRouter model slug to use for visual reasoning",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=True,
        help="Run browser in headless mode",
    )
    parser.add_argument(
        "--gif",
        default=None,
        help="Path to save action recording GIF",
    )
    return parser.parse_args()


async def run_application_agent(args):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        return {
            "ok": False,
            "status": "failed",
            "fieldsFilled": [],
            "detail": "OPENROUTER_API_KEY is not configured in the environment.",
            "error": "MISSING_API_KEY",
        }

    try:
        from browser_use import Agent, ChatOpenRouter
        from browser_use.browser.profile import BrowserProfile
    except ImportError as exc:
        return {
            "ok": False,
            "status": "failed",
            "fieldsFilled": [],
            "detail": f"Browser Use dependencies missing: {exc}",
            "error": "MISSING_DEPENDENCIES",
        }

    # Load candidate profile
    candidate_file = Path(args.candidate_json)
    if not candidate_file.exists():
        return {
            "ok": False,
            "status": "failed",
            "fieldsFilled": [],
            "detail": f"Candidate profile JSON file not found: {args.candidate_json}",
            "error": "NOT_FOUND",
        }

    with open(candidate_file, "r", encoding="utf-8") as f:
        candidate_data = json.load(f)

    # Validate resume path if provided
    available_files = []
    if args.resume:
        resume_file = Path(args.resume)
        if resume_file.exists():
            available_files.append(str(resume_file.resolve()))

    # Build prompt instructions
    dry_run_instruction = (
        "DRY RUN MODE IS ACTIVE. When you reach the final application page or review screen "
        "where all fields and uploads are in place, DO NOT click 'Submit', 'Finish', or 'Send Application'. "
        "Stop at the review step and declare completion."
        if args.dry_run
        else "Review all filled fields and click the final Submit button to complete the submission."
    )

    resume_instruction = (
        f"Upload the candidate's resume PDF located at: {available_files[0]}"
        if available_files
        else "No resume file provided."
    )

    task_prompt = f"""
Navigate to the following job application page: {args.url}

Applicant Profile:
- Full Name: {candidate_data.get('fullName', candidate_data.get('name', 'Solomon S. Joseph'))}
- Email: {candidate_data.get('email', 'solomonjosephusa98@gmail.com')}
- Phone: {candidate_data.get('phone', '862-236-7612')}
- City/Location: {candidate_data.get('location', candidate_data.get('city', 'New York, NY'))}
- LinkedIn: {candidate_data.get('linkedin', 'https://linkedin.com/in/solomonsjoseph')}
- GitHub: {candidate_data.get('github', 'https://github.com/brucebanner010198-commits')}

Resume:
{resume_instruction}

Instructions:
1. Locate and fill all corresponding fields on the application form (First Name, Last Name, Email, Phone, Location, Profiles).
2. If there is a resume file upload input, attach the resume file.
3. If there are standard questions regarding work authorization, answer that the applicant is legally authorized to work in the US and does not currently require sponsorship.
4. {dry_run_instruction}
5. Return a brief summary of the fields filled and the state of the form.
"""

    llm = ChatOpenRouter(
        model=args.model,
        api_key=api_key,
        temperature=0.0,
    )

    browser_profile = BrowserProfile(
        headless=args.headless,
    )

    agent_kwargs: dict[str, Any] = {
        "task": task_prompt,
        "llm": llm,
        "browser_profile": browser_profile,
        "use_vision": True,
    }

    if available_files:
        agent_kwargs["available_file_paths"] = available_files

    if args.gif:
        agent_kwargs["generate_gif"] = args.gif

    agent = Agent(**agent_kwargs)

    try:
        history = await agent.run(max_steps=20)
        final_result = history.final_result() or "Workflow finished."
        actions_taken = history.action_names()

        steps_count = history.number_of_steps() if hasattr(history, "number_of_steps") else len(history)

        errors = history.errors()
        has_critical_error = len(errors) > 0 and (len(actions_taken) == 0 or len(errors) >= steps_count)

        if has_critical_error:
            return {
                "ok": False,
                "status": "failed",
                "fieldsFilled": actions_taken,
                "detail": f"Agent failed: {errors[-1]}",
                "steps": steps_count,
                "errors": errors,
            }

        return {
            "ok": True,
            "status": "review_reached" if args.dry_run else "submitted",
            "fieldsFilled": actions_taken,
            "detail": final_result,
            "steps": steps_count,
            "errors": errors,
        }
    except Exception as err:
        return {
            "ok": False,
            "status": "failed",
            "fieldsFilled": [],
            "detail": str(err),
            "error": "EXECUTION_ERROR",
        }


def main():
    args = parse_args()
    result = asyncio.run(run_application_agent(args))
    json_output = json.dumps(result, indent=2)
    print(json_output)
    if not result.get("ok"):
        sys.exit(1)


if __name__ == "__main__":
    main()
