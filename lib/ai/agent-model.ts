/**
 * Model choice for the browser agents (Python Browser Use scripts).
 * Same privacy rules as chat: local unless the user consented to the task.
 */
import { getSecret } from "@/lib/secrets";
import { getAiSettings } from "./settings";
import { decideRoute, type CloudProvider } from "./routing";
import { resolveLocalModel } from "./local";
import type { TaskName } from "./models";

/** Providers the Python scripts know how to build (scripts/browser_use_llm.py). */
const AGENT_CLOUD: CloudProvider[] = ["gemini", "openrouter"];

export interface AgentModel {
  provider: "ollama" | "gemini" | "openrouter";
  model: string;
  /** Present only for cloud providers; passed to the child process, never logged. */
  apiKey?: string;
  ollamaUrl: string;
  destination: string;
}

export async function resolveAgentModel(task: TaskName): Promise<AgentModel> {
  const settings = await getAiSettings();
  const keys: Partial<Record<CloudProvider, string>> = {};
  for (const provider of AGENT_CLOUD) {
    const key = await getSecret(provider === "gemini" ? "GEMINI_API_KEY" : "OPENROUTER_API_KEY");
    if (key?.trim()) keys[provider] = key.trim();
  }

  const route = decideRoute({
    settings,
    task,
    availableCloud: new Set(Object.keys(keys) as CloudProvider[]),
  });

  if (route.kind === "cloud" && (route.provider === "gemini" || route.provider === "openrouter")) {
    const gemini = route.provider === "gemini";
    return {
      provider: route.provider,
      model: gemini
        ? (await getSecret("GEMINI_MODEL")) || "gemini-3.8-flash"
        : (await getSecret("OPENROUTER_AGENT_MODEL")) || "google/gemini-3.8-flash",
      apiKey: keys[route.provider],
      ollamaUrl: settings.localBaseUrl,
      destination: gemini ? "generativelanguage.googleapis.com" : "openrouter.ai",
    };
  }

  return {
    provider: "ollama",
    model: await resolveLocalModel(settings.localBaseUrl, settings.localModel),
    ollamaUrl: settings.localBaseUrl,
    destination: new URL(settings.localBaseUrl).host,
  };
}
