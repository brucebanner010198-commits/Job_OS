/**
 * Fixture Gmail adapter (Phase 6) - the deterministic, offline default. Yields
 * the curated corpus (lib/track/fixtures.ts) so the tracker, the test gate, and
 * the /track preview all work with zero Google setup. This is what runs until
 * the user connects a real account.
 */

import type { GmailSource } from "@/lib/gmail/types";
import { fixtureRawEmails } from "@/lib/track/fixtures";

export function fixtureGmailSource(): GmailSource {
  return {
    id: "fixture",
    isLive: false,
    emailAddress: undefined,
    async listJobEmails() {
      return fixtureRawEmails;
    },
  };
}
