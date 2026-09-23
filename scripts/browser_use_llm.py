"""
Shared model setup for the Browser Use scripts.

The Node app decides the provider (local Ollama in private mode, a cloud model
only with the user's consent) and passes the key through JOBOS_LLM_API_KEY.
Keys are never read from .env: that file held a stale key and silently won
over the one saved in the app.
"""

import json
import os
from pathlib import Path

# Browser Use reports anonymous usage to its maker by default; Job OS keeps
# everything local, so both switches are off before the library is imported.
os.environ.setdefault("ANONYMIZED_TELEMETRY", "false")
os.environ.setdefault("BROWSER_USE_CLOUD_SYNC", "false")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROVIDERS = ("ollama", "gemini", "openrouter")
DEFAULT_MODELS = {
    "ollama": "gemma4:12b",
    "gemini": "gemini-3.8-flash",
    "openrouter": "google/gemini-3.8-flash",
}
SECRET_NAMES = {"gemini": "GEMINI_API_KEY", "openrouter": "OPENROUTER_API_KEY"}


def add_llm_args(parser):
    parser.add_argument("--provider", choices=PROVIDERS, default="ollama")
    parser.add_argument("--model", default=None, help="Model id for the chosen provider")
    parser.add_argument(
        "--ollama-url",
        default=os.getenv("JOBOS_OLLAMA_URL", "http://127.0.0.1:11434"),
        help="Ollama server root",
    )


def _api_key(provider):
    key = os.getenv("JOBOS_LLM_API_KEY")
    if key:
        return key
    # Standalone runs (npm run test:browser-use) read the app's own secret store.
    store = PROJECT_ROOT / ".secrets" / "keys.json"
    if store.exists():
        try:
            return json.loads(store.read_text(encoding="utf-8")).get(SECRET_NAMES[provider]) or None
        except (OSError, ValueError):
            return None
    return None


def build_llm(args):
    """Returns (llm, error_message). error_message is None on success."""
    model = args.model or DEFAULT_MODELS[args.provider]

    if args.provider == "ollama":
        from browser_use import ChatOllama

        # Page screenshots plus DOM state need a larger context than Ollama's
        # default; hidden reasoning is off because it multiplies step latency,
        # and keep_alive holds the model in memory between steps.
        options = {"num_ctx": 32768, "think": False, "keep_alive": "30m"}
        return ChatOllama(model=model, host=args.ollama_url, ollama_options=options), None

    key = _api_key(args.provider)
    if not key:
        return None, f"No API key for {args.provider}. Add it in Settings, or use --provider ollama."

    if args.provider == "gemini":
        from browser_use import ChatGoogle

        return ChatGoogle(model=model, api_key=key, temperature=0.0), None

    from browser_use import ChatOpenRouter

    return ChatOpenRouter(model=model, api_key=key, temperature=0.0), None


def agent_speed_kwargs(args):
    """Agent settings that keep local models inside their time budget.

    Laptop GPUs process the multi-thousand-token page prompt slowly, so local
    runs use short replies, low-detail screenshots and a longer per-call timeout.
    """
    if args.provider != "ollama":
        return {}
    return {"flash_mode": True, "use_thinking": False, "vision_detail_level": "low", "llm_timeout": 240}


def real_errors(history):
    """history.errors() holds one entry per step, None when the step succeeded."""
    return [e for e in history.errors() if e]
