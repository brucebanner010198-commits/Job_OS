/**
 * Gmail OAuth CSRF state (SEC-08) - random nonce bound to active profile.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GMAIL_OAUTH_STATE_COOKIE = "gmail_oauth_state";

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  return process.env.JOB_OS_ACCESS_TOKEN ?? "job-os-gmail-oauth-dev";
}

/** Signed state token: profileId + nonce + expiry. */
export function createOAuthState(profileId: string): string {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = Date.now() + STATE_TTL_MS;
  const payload = `${profileId}:${nonce}:${expiresAt}`;
  const sig = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("hex");
  return `${payload}:${sig}`;
}

export function verifyOAuthState(state: string): { profileId: string } | null {
  const parts = state.split(":");
  if (parts.length !== 4) return null;

  const [profileId, nonce, expiresRaw, sig] = parts;
  if (!profileId || !nonce || !expiresRaw || !sig) return null;
  if (!/^[0-9a-f]{64}$/.test(sig)) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const payload = `${profileId}:${nonce}:${expiresRaw}`;
  const expected = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("hex");

  try {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  return { profileId };
}
