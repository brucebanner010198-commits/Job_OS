/**
 * Decides where a model call runs. Pure, so the privacy rules are testable
 * without a network or a secret store.
 */
import type { AiSettings } from "./settings";
import type { TaskName } from "./models";

export type CloudProvider = "gemini" | "openai" | "anthropic" | "openrouter";

export type Route =
  | { kind: "local" }
  | { kind: "cloud"; provider: CloudProvider; redact: boolean };

/**
 * Tasks that never leave the machine, whatever the mode.
 * classifyEmail: Google's API user-data policy restricts sending Gmail
 * content to third-party AI models.
 */
export const LOCAL_ONLY_TASKS: ReadonlySet<TaskName> = new Set(["classifyEmail"]);

/**
 * Tasks whose purpose is reading contact details (resume import). Everything
 * else going to the cloud has emails and phone numbers scrubbed first.
 */
const CONTACT_TASKS: ReadonlySet<TaskName> = new Set(["parseResume", "extractProfile"]);

/** Preference order when several cloud keys exist. */
const CLOUD_ORDER: CloudProvider[] = ["gemini", "openai", "anthropic", "openrouter"];

export function decideRoute(input: {
  settings: AiSettings;
  task?: TaskName;
  availableCloud: ReadonlySet<CloudProvider>;
  requested?: CloudProvider | "ollama";
}): Route {
  const { settings, task, availableCloud, requested } = input;

  if (settings.mode !== "enhanced" || !settings.consent) return { kind: "local" };
  if (requested === "ollama") return { kind: "local" };
  if (task && LOCAL_ONLY_TASKS.has(task)) return { kind: "local" };
  // Untagged calls cannot be matched against consent, so they stay local.
  if (!task || !settings.consent.tasks.includes(task)) return { kind: "local" };

  const provider =
    requested && availableCloud.has(requested)
      ? requested
      : CLOUD_ORDER.find((p) => availableCloud.has(p));
  if (!provider) return { kind: "local" };

  return { kind: "cloud", provider, redact: !CONTACT_TASKS.has(task) };
}
