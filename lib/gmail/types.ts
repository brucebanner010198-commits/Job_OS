/**
 * Gmail seam (Phase 6). The app reads Gmail behind this interface so the brain
 * + UI never depend on a live network. Two adapters implement it:
 *
 *   - fixtureGmailSource()  - deterministic corpus (lib/track/fixtures.ts);
 *     the default, runs fully offline, drives the test gate.
 *   - liveGmailSource()     - the real adapter: Gmail REST API over fetch with
 *     an OAuth access token (lib/gmail/source-live.ts). Enabled only when
 *     GMAIL_ENABLED=1 and credentials + a refresh token are present.
 *
 * This mirrors the JSearch pattern (lib/jobs/sources): the live source returns
 * [] / falls back to fixtures rather than throwing when unconfigured, so the
 * app stays fully usable without any Google setup.
 */

import type { RawEmail } from "@/lib/track/types";

export interface GmailListOptions {
  /** How many days back to pull (speed-first default). */
  sinceDays?: number;
  /** Max threads to fetch. */
  max?: number;
  /** Override the default job-biased Gmail search query. */
  query?: string;
}

export interface GmailSource {
  /** Adapter id, e.g. "fixture" | "live". */
  id: string;
  /** True only for the real network-backed adapter. */
  isLive: boolean;
  /** The connected account address, when known. */
  emailAddress?: string;
  /** Fetch job-relevant emails, newest first. Never throws - returns [] on failure. */
  listJobEmails(opts?: GmailListOptions): Promise<RawEmail[]>;
  /** Current Gmail historyId watermark (live only); undefined for fixtures. */
  currentHistoryId?(): Promise<string | undefined>;
}
