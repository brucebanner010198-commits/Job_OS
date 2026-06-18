/**
 * Synchronous secret read for hot paths that must stay sync (JobSource.enabled,
 * voice configured checks). Mirrors composite order: file → env.
 */
import { existsSync, readFileSync, statSync } from "fs";
import path from "path";
import { FILE_KEYS_PATH } from "@/lib/secrets/file-store";

let fileCache: Record<string, string> | null = null;
let fileMtime = 0;

function loadFileKeys(): Record<string, string> {
  try {
    if (!existsSync(FILE_KEYS_PATH)) return {};
    const stat = statSync(FILE_KEYS_PATH);
    if (fileCache && stat.mtimeMs === fileMtime) return fileCache;
    const raw = readFileSync(FILE_KEYS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    fileCache =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, string>)
        : {};
    fileMtime = stat.mtimeMs;
    return fileCache;
  } catch {
    return {};
  }
}

/** Invalidate sync cache after portal writes (tests). */
export function invalidateSecretSyncCache(): void {
  fileCache = null;
  fileMtime = 0;
}

export function getSecretSync(key: string): string | undefined {
  const fromFile = loadFileKeys()[key];
  if (fromFile?.trim()) return fromFile.trim();
  const fromEnv = process.env[key];
  return fromEnv?.trim() || undefined;
}
