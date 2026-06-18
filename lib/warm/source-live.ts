/**
 * Live ConnectionSource - reads the user's OWN LinkedIn network via their local,
 * already-logged-in browser session (plan §9, Hardening §D/§F).
 *
 * --------------------------------------------------------------------------
 * WHY THIS IS A DOCUMENTED LOCAL-ONLY DROP-IN (not wired live here)
 * --------------------------------------------------------------------------
 * Exactly like the simulated Playwright apply driver (Phase 5) and the JSearch
 * data spine, the REAL implementation belongs to the packaged local desktop app,
 * where it can drive a dedicated, isolated, encrypted Chrome profile behind
 * FileVault. It is deliberately NOT executed in this web build. This module is
 * the seam: it conforms to ConnectionSource, is env-gated, and returns [] until
 * a local session is wired in - so the app always builds and runs offline.
 *
 * HARD RULES the real adapter MUST honor (encoded here as the contract):
 *   - OWN ACCOUNT ONLY. It reads the USER'S first/second-degree connections from
 *     the user's own authenticated session. It NEVER scrapes other people's
 *     networks, and NEVER operates at scale - LinkedIn bans bots and the live
 *     session cookies are the single highest-value secret in the system.
 *   - HUMAN-IN-THE-LOOP, LOW-VOLUME. Discovery is on-demand for a named target
 *     company, paced like a human, not a background crawl.
 *   - LOCAL ONLY. Auto-disabled on any cloud deploy (no residential session,
 *     no isolated profile). `WARM_LINKEDIN_ENABLED` must be explicitly set AND
 *     the local session present.
 *   - NEVER THROWS. A missing/expired session yields [] → the app falls back to
 *     fixtures and the UI prompts the user to connect.
 *
 * The user can always import connections manually / via CSV instead (source
 * "import" / "manual"), which needs none of the above.
 */

import type {
  Connection,
  ConnectionListOptions,
  ConnectionSource,
} from "@/lib/warm/types";

/**
 * Live only when explicitly enabled. On a cloud deploy this is force-disabled
 * (there is no local browser/session to drive). The real adapter additionally
 * verifies a present, valid local LinkedIn session before reporting live.
 */
export function liveLinkedInEnabled(): boolean {
  // Autonomy/automation auto-disables on cloud (Hardening §A/§D).
  if (process.env.JOB_OS_CLOUD === "1") return false;
  return process.env.WARM_LINKEDIN_ENABLED === "1";
}

export function liveConnectionSource(): ConnectionSource {
  return {
    id: "linkedin-local",
    isLive: true,

    async listConnections(_opts?: ConnectionListOptions): Promise<Connection[]> {
      // Seam only. The packaged desktop app supplies the real local-session
      // reader here. Until then, degrade to [] (never throw) so callers fall
      // back to fixtures / manual import.
      return [];
    },
  };
}
