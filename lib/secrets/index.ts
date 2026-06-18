/**
 * Pluggable secret store.
 *
 * Default resolution order (web/dev): portal file store → `.env`.
 * Desktop (`JOB_OS_DESKTOP=1`): macOS keychain → portal file → `.env`.
 *
 * Secrets that flow through here: OPENROUTER_API_KEY, Gmail OAuth tokens,
 * ElevenLabs keys. They must never be written to the repo or logged.
 */
import { compositeSecretStore } from "@/lib/secrets/composite";

export interface SecretStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Read-only store backed by process.env (`.env`, gitignored). */
class EnvSecretStore implements SecretStore {
  async get(key: string): Promise<string | undefined> {
    const v = process.env[key];
    return v !== undefined && v !== "" ? v : undefined;
  }
  async set(): Promise<void> {
    throw new Error(
      "EnvSecretStore is read-only. Use the Integrations portal or setSecret().",
    );
  }
  async delete(): Promise<void> {
    throw new Error("EnvSecretStore is read-only.");
  }
}

let storeOverride: SecretStore | undefined;
let defaultInit: Promise<SecretStore> | null = null;

async function resolveStore(): Promise<SecretStore> {
  if (storeOverride) return storeOverride;
  if (!defaultInit) {
    defaultInit = (async () => {
      const { fileSecretStore } = await import("@/lib/secrets/file-store");
      const env = new EnvSecretStore();
      const file = fileSecretStore();
      return compositeSecretStore({ read: [file, env], write: file });
    })();
  }
  return defaultInit;
}

export function setSecretStore(next: SecretStore): void {
  storeOverride = next;
}

export async function getSecret(key: string): Promise<string | undefined> {
  return (await resolveStore()).get(key);
}

export async function setSecret(key: string, value: string): Promise<void> {
  return (await resolveStore()).set(key, value);
}

export async function deleteSecret(key: string): Promise<void> {
  return (await resolveStore()).delete(key);
}
