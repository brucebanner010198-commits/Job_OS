/**
 * Warm-path source selector - picks the live local-LinkedIn adapter only when it
 * is explicitly enabled (and not on cloud); otherwise the deterministic fixture
 * source. Mirrors lib/gmail/index.ts (getGmailSource / gmailStatus).
 */

import type { ConnectionSource, WarmStatus } from "@/lib/warm/types";
import { fixtureConnectionSource } from "@/lib/warm/source-fixture";
import { liveConnectionSource, liveLinkedInEnabled } from "@/lib/warm/source-live";

/**
 * The active ConnectionSource. Live iff the local LinkedIn adapter is enabled
 * AND it actually has connections to offer; otherwise fixtures. Never throws -
 * a failing/empty live source degrades to fixtures so the page always renders.
 */
export async function getConnectionSource(): Promise<ConnectionSource> {
  if (!liveLinkedInEnabled()) return fixtureConnectionSource();

  try {
    const live = liveConnectionSource();
    const probe = await live.listConnections({ max: 1 });
    if (probe.length > 0) return live;
  } catch {
    // fall through to fixtures
  }
  return fixtureConnectionSource();
}

/** Connect/disconnect card status. */
export async function warmStatus(): Promise<WarmStatus> {
  const enabled = liveLinkedInEnabled();
  if (!enabled) return { enabled: false, connected: false, live: false };

  let connected = false;
  try {
    const live = liveConnectionSource();
    const probe = await live.listConnections({ max: 1 });
    connected = probe.length > 0;
  } catch {
    connected = false;
  }
  return { enabled: true, connected, live: connected };
}
