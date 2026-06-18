/**
 * Gmail OAuth (Phase 6) - the official Google OAuth 2.0 web-app flow, done with
 * plain `fetch` (no `googleapis` dependency). The app requests `gmail.readonly`
 * only: it reads to PROPOSE status changes, it never sends or modifies mail.
 *
 *   buildAuthUrl   → the consent URL the /api/gmail/auth route redirects to
 *   exchangeCode   → callback: authorization code → tokens (stored locally)
 *   getAccessToken → mint/refresh a short-lived access token on demand
 *
 * `invalid_grant` (revoked / expired refresh token) surfaces as a quiet
 * `undefined` from getAccessToken so the UI can prompt a reconnect instead of
 * crashing - see lib/gmail/source-live.ts.
 */

import { getSecret } from "@/lib/secrets";
import {
  readTokens,
  writeTokens,
  type GmailTokens,
} from "@/lib/gmail/token-store";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PROFILE_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/profile";

/** Read-only Gmail scope - the minimum needed for the tracker. */
export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** OAuth client config from the secret store; undefined when not set up. */
export async function getConfig(): Promise<GmailConfig | undefined> {
  const [clientId, clientSecret, redirectUri] = await Promise.all([
    getSecret("GMAIL_CLIENT_ID"),
    getSecret("GMAIL_CLIENT_SECRET"),
    getSecret("GMAIL_REDIRECT_URI"),
  ]);
  if (!clientId || !clientSecret) return undefined;
  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri || "http://localhost:3000/api/gmail/callback",
  };
}

/**
 * Live Gmail is used only when an OAuth client is configured AND the kill-switch
 * isn't off. `GMAIL_ENABLED=0` forces offline fixtures even when connected.
 */
export async function isEnabled(): Promise<boolean> {
  if ((await getSecret("GMAIL_ENABLED")) === "0") return false;
  return Boolean(await getConfig());
}

export function buildAuthUrl(cfg: GmailConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force a refresh token on every connect
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/** Callback step: exchange the authorization code for tokens and persist them. */
export async function exchangeCode(
  cfg: GmailConfig,
  code: string,
  profileId?: string,
): Promise<GmailTokens> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`Gmail token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  if (!data.refresh_token) {
    throw new Error(
      "Google returned no refresh_token. Revoke the app's access at " +
        "myaccount.google.com/permissions and reconnect (prompt=consent).",
    );
  }
  const tokens: GmailTokens = {
    refreshToken: data.refresh_token,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  try {
    tokens.emailAddress = await fetchEmailAddress(data.access_token);
  } catch {
    // address is display-only; never fail the connect over it
  }
  await writeTokens(tokens, profileId);
  return tokens;
}

/**
 * Return a valid access token, refreshing if the cached one is near expiry.
 * Returns undefined when unconfigured or when the refresh token is invalid
 * (the caller treats undefined as "not connected / reconnect needed").
 */
export async function getAccessToken(profileId?: string): Promise<string | undefined> {
  const cfg = await getConfig();
  const tokens = await readTokens(profileId);
  if (!cfg || !tokens?.refreshToken) return undefined;

  // Reuse a still-valid cached token (>60s of life left).
  if (
    tokens.accessToken &&
    tokens.expiresAt &&
    tokens.expiresAt - Date.now() > 60_000
  ) {
    return tokens.accessToken;
  }

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  if (!res.ok) {
    // invalid_grant etc. - surface as "reconnect needed", don't throw.
    return undefined;
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  await writeTokens({
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }, profileId);
  return data.access_token;
}

async function fetchEmailAddress(accessToken: string): Promise<string | undefined> {
  const res = await fetch(PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { emailAddress?: string };
  return data.emailAddress;
}
