import { getSecret } from "@/lib/secrets";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

export type OpenRouterProbeStatus = "ok" | "invalid" | "missing";

/**
 * Lightweight OpenRouter auth check — never returns or logs the API key.
 */
export async function probeOpenRouter(): Promise<OpenRouterProbeStatus> {
  const apiKey = (await getSecret("OPENROUTER_API_KEY"))?.trim();
  if (!apiKey) return "missing";

  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403) return "invalid";
    if (!res.ok) return "invalid";
    return "ok";
  } catch {
    return "invalid";
  }
}
