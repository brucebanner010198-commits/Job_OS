/**
 * Backup app-key resolution (Phase 11, Hardening §D). The automated backup path
 * needs a stable 32-byte key with NO passphrase friction, so:
 *
 *   1. If BACKUP_KEY is set (env / future keychain via the secret store), use it.
 *   2. Otherwise use a local key file at /.secrets/backup.key (mode 0600), and
 *      generate it on first use. /.secrets is already gitignored and FileVault
 *      protects it at rest; Phase 12's OS-keychain store supersedes this.
 *
 * `peekKeySource()` reports where the key WOULD come from without creating
 * anything - so merely rendering the /backups page never writes a key file.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { generateKeyBase64, keyFromString } from "@/lib/backup/crypto";
import { getSecret } from "@/lib/secrets";
import type { KeySource } from "@/lib/backup/types";

const KEY_DIR = path.join(process.cwd(), ".secrets");
const KEY_FILE = path.join(KEY_DIR, "backup.key");

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Report the key source without side effects (no file creation). */
export async function peekKeySource(): Promise<KeySource> {
  if (await getSecret("BACKUP_KEY")) return "env";
  if (await fileExists(KEY_FILE)) return "app-key";
  return "none";
}

/**
 * Resolve the 32-byte backup key, generating + persisting a local key file on
 * first use. Returns the key and where it came from.
 */
export async function loadBackupKey(): Promise<{
  key: Buffer;
  source: KeySource;
}> {
  const fromEnv = await getSecret("BACKUP_KEY");
  if (fromEnv) return { key: keyFromString(fromEnv), source: "env" };

  if (await fileExists(KEY_FILE)) {
    const raw = (await fs.readFile(KEY_FILE, "utf8")).trim();
    return { key: keyFromString(raw), source: "app-key" };
  }

  // First run: generate, persist with tight permissions, return.
  const base64 = generateKeyBase64();
  await fs.mkdir(KEY_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(KEY_FILE, base64, { mode: 0o600 });
  return { key: keyFromString(base64), source: "app-key" };
}
