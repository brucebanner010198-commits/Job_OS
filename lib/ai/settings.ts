/**
 * AI settings: privacy mode, cloud consent, and the local model endpoint.
 *
 * Two modes:
 *   - "private"  (default): every model call runs on this machine.
 *   - "enhanced" (opt-in):  cloud models may be used for the tasks the user
 *                           consented to. Consent is versioned and revocable.
 *
 * Settings live in the secret store (not the DB) so routing still works when
 * Postgres is down.
 */
import { getSecret, setSecret } from "@/lib/secrets";
import type { TaskName } from "./models";

export type PrivacyMode = "private" | "enhanced";

/** Bump when the consent text shown to the user changes materially. */
export const CLOUD_CONSENT_VERSION = 1;

export interface CloudConsent {
  version: number;
  grantedAt: string;
  /** Tasks allowed to leave the machine. Empty means none. */
  tasks: TaskName[];
}

export interface AiSettings {
  mode: PrivacyMode;
  consent: CloudConsent | null;
  /** Ollama server root, e.g. http://127.0.0.1:11434 (no /v1). */
  localBaseUrl: string;
  /** Explicit local model name, if the user picked one. */
  localModel?: string;
}

// 127.0.0.1 rather than "localhost": other containers may also publish 11434
// on the IPv6 wildcard, and "localhost" can resolve to either.
export const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434";

/** Accepts ".../v1", trailing slashes, or a bare host:port and returns the server root. */
export function normalizeLocalBaseUrl(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_LOCAL_BASE_URL;
  const withScheme = /^https?:\/\//.test(value) ? value : `http://${value}`;
  return withScheme
    .replace(/\/+$/, "")
    .replace(/\/v1$/, "")
    .replace(/^(https?:\/\/)localhost(?=[:/]|$)/, "$1127.0.0.1");
}

function parseConsent(raw: string | undefined): CloudConsent | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CloudConsent;
    if (parsed.version !== CLOUD_CONSENT_VERSION) return null;
    if (!Array.isArray(parsed.tasks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Older installs stored AI_MODEL_PREFERENCE / AI_DEFAULT_TIER. An explicit
 * "paid" choice there counts as enhanced; everything else stays private.
 */
function legacyMode(preference?: string, tier?: string): PrivacyMode {
  if (preference === "paid") return "enhanced";
  if (preference === "both" && tier === "paid") return "enhanced";
  return "private";
}

export async function getAiSettings(): Promise<AiSettings> {
  const [modeRaw, consentRaw, baseUrl, model, preference, tier] = await Promise.all([
    getSecret("AI_PRIVACY_MODE"),
    getSecret("AI_CLOUD_CONSENT"),
    getSecret("OLLAMA_BASE_URL"),
    getSecret("LOCAL_MODEL_NAME"),
    getSecret("AI_MODEL_PREFERENCE"),
    getSecret("AI_DEFAULT_TIER"),
  ]);

  const mode: PrivacyMode =
    modeRaw === "private" || modeRaw === "enhanced" ? modeRaw : legacyMode(preference, tier);

  return {
    mode,
    consent: parseConsent(consentRaw),
    localBaseUrl: normalizeLocalBaseUrl(baseUrl),
    localModel: model?.trim() || undefined,
  };
}

export async function grantCloudConsent(tasks: TaskName[]): Promise<CloudConsent> {
  const consent: CloudConsent = {
    version: CLOUD_CONSENT_VERSION,
    grantedAt: new Date().toISOString(),
    tasks,
  };
  await setSecret("AI_CLOUD_CONSENT", JSON.stringify(consent));
  await setSecret("AI_PRIVACY_MODE", "enhanced");
  return consent;
}

/** Revoking switches back to private immediately; the consent record is cleared. */
export async function revokeCloudConsent(): Promise<void> {
  await setSecret("AI_CLOUD_CONSENT", "");
  await setSecret("AI_PRIVACY_MODE", "private");
}
