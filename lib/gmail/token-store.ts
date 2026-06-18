/**
 * Gmail OAuth token storage (Phase 6, Hardening §D).
 *
 * Tokens are the second-highest-value secret in the app (after the master
 * profile), so they NEVER go in the database and NEVER in the repo. In this
 * local-first dev build they live in a gitignored `.secrets/gmail.json`
 * (mode 0600). The packaged desktop build swaps this for the OS keychain via
 * the existing `setSecretStore()` seam - no call-site changes.
 *
 * A `GMAIL_REFRESH_TOKEN` env var (read through the secret store) overrides the
 * file, for headless/CI use where a one-time consent produced a refresh token.
 *
 * IMPORTANT: keep `.secrets/` out of iCloud/Time-Machine sync and behind
 * FileVault (plan §D). This file is the crown-jewel session credential.
 */

import { promises as fs } from "fs";
import path from "path";
import { getSecret } from "@/lib/secrets";

export interface GmailTokens {
  refreshToken: string;
  accessToken?: string;
  /** Epoch ms when accessToken expires. */
  expiresAt?: number;
  /** The connected account address (for display). */
  emailAddress?: string;
}

const TOKEN_DIR = path.join(process.cwd(), ".secrets");
const LEGACY_TOKEN_FILE = path.join(TOKEN_DIR, "gmail.json");

function tokenFile(profileId?: string): string {
  if (!profileId) return LEGACY_TOKEN_FILE;
  return path.join(TOKEN_DIR, `gmail-${profileId}.json`);
}

export async function readTokens(profileId?: string): Promise<GmailTokens | undefined> {
  let fileTokens: GmailTokens | undefined;
  const file = tokenFile(profileId);
  try {
    fileTokens = JSON.parse(await fs.readFile(file, "utf8")) as GmailTokens;
  } catch {
    // Fall back to legacy single-user file when profile-scoped file is absent.
    if (profileId) {
      try {
        fileTokens = JSON.parse(
          await fs.readFile(LEGACY_TOKEN_FILE, "utf8"),
        ) as GmailTokens;
      } catch {
        fileTokens = undefined;
      }
    } else {
      fileTokens = undefined;
    }
  }

  // An env-provided refresh token (one-time consent / CI) overrides the file.
  const envRefresh = await getSecret("GMAIL_REFRESH_TOKEN");
  if (envRefresh) {
    return { ...(fileTokens ?? {}), refreshToken: envRefresh };
  }
  return fileTokens;
}

export async function writeTokens(
  tokens: GmailTokens,
  profileId?: string,
): Promise<void> {
  await fs.mkdir(TOKEN_DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(tokenFile(profileId), JSON.stringify(tokens, null, 2), {
    mode: 0o600,
  });
}

export async function clearTokens(profileId?: string): Promise<void> {
  try {
    await fs.unlink(tokenFile(profileId));
  } catch {
    // already gone - nothing to do
  }
}

/** True when a refresh token exists (the account is connected). */
export async function isConnected(profileId?: string): Promise<boolean> {
  const t = await readTokens(profileId);
  return Boolean(t?.refreshToken);
}
