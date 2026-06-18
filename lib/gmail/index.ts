/**
 * Gmail source selector (Phase 6). Returns the LIVE adapter only when an OAuth
 * client is configured, the kill-switch is on, and an account is connected;
 * otherwise the deterministic fixture adapter. Same shape as the JSearch
 * discovery selector in lib/jobs/sources.
 */

import type { AppScope } from "@/lib/profiles/types";
import type { GmailSource } from "@/lib/gmail/types";
import { isEnabled } from "@/lib/gmail/oauth";
import { isConnected, readTokens } from "@/lib/gmail/token-store";
import { liveGmailSource } from "@/lib/gmail/source-live";
import { fixtureGmailSource } from "@/lib/gmail/source-fixture";

export async function getGmailSource(scope?: AppScope): Promise<GmailSource> {
  const profileId = scope?.profileId;
  if ((await isEnabled()) && (await isConnected(profileId))) {
    return liveGmailSource(profileId);
  }
  return fixtureGmailSource();
}

export interface GmailStatus {
  /** OAuth client configured + kill-switch on. */
  enabled: boolean;
  /** A refresh token is present. */
  connected: boolean;
  /** Live data is actually flowing (enabled && connected). */
  live: boolean;
  emailAddress?: string;
}

export async function gmailStatus(scope?: AppScope): Promise<GmailStatus> {
  const profileId = scope?.profileId;
  const enabled = await isEnabled();
  const connected = await isConnected(profileId);
  const tokens = connected ? await readTokens(profileId) : undefined;
  return {
    enabled,
    connected,
    live: enabled && connected,
    emailAddress: tokens?.emailAddress,
  };
}
