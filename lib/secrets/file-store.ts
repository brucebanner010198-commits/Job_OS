/**
 * Writable file-backed secret store - keys live in `.secrets/keys.json`
 * (gitignored, mode 0600). Used by the Integrations portal on web/dev builds.
 */
import { chmod, mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { SecretStore } from "@/lib/secrets";

const SECRETS_DIR = path.join(process.cwd(), ".secrets");
const KEYS_FILE = path.join(SECRETS_DIR, "keys.json");

async function loadKeys(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(KEYS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

async function saveKeys(data: Record<string, string>): Promise<void> {
  await mkdir(SECRETS_DIR, { recursive: true, mode: 0o700 });
  await writeFile(KEYS_FILE, JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  });
  await chmod(SECRETS_DIR, 0o700).catch(() => {});
}

/** File-backed SecretStore for portal-written keys. */
export function fileSecretStore(): SecretStore {
  return {
    async get(key: string): Promise<string | undefined> {
      const data = await loadKeys();
      const v = data[key];
      return v !== undefined && v !== "" ? v : undefined;
    },
    async set(key: string, value: string): Promise<void> {
      const data = await loadKeys();
      data[key] = value;
      await saveKeys(data);
    },
    async delete(key: string): Promise<void> {
      const data = await loadKeys();
      delete data[key];
      await saveKeys(data);
    },
  };
}

export const FILE_KEYS_PATH = KEYS_FILE;
