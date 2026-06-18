/**
 * Gmail push-relay seam (Phase 9, plan §9 - "optional Gmail push relay"). This is
 * the ONE optional always-on cloud piece in an otherwise local-first system. The
 * DEFAULT is polling on wake via the launchd catch-up runner; the relay is a tiny
 * always-on subscriber to a Gmail `watch` Pub/Sub topic that pings the local app
 * for near-instant interview-invite sync.
 *
 * Like the live-Gmail and live-voice seams, this is a DOCUMENTED interface, not a
 * built service: pushRelayStatus() only reports configuration from env and never
 * throws. Wiring an actual Cloud Run/Function subscriber is a local/cloud setup
 * step the user opts into - nothing here starts a paid always-on service by
 * itself, and nothing here weakens the propose-don't-auto-apply guarantee (the
 * relay only triggers the same idempotent sync the poller runs).
 */
import type { PushRelayStatus } from "@/lib/scheduler/types";

/** The Pub/Sub topic a Gmail `watch` publishes to, e.g. projects/<p>/topics/gmail. */
function topic(): string | undefined {
  const t = process.env.GMAIL_PUBSUB_TOPIC?.trim();
  return t ? t : undefined;
}

/** Master kill-switch - set GMAIL_PUSH_ENABLED=0 to force polling even if a topic is set. */
function enabled(): boolean {
  return process.env.GMAIL_PUSH_ENABLED !== "0";
}

/**
 * Report the push-relay configuration. Never throws.
 *   - no topic               → provider "none", polling on wake (the default).
 *   - topic but disabled     → configured, not enabled (kill-switch on).
 *   - topic + enabled        → configured + enabled (near-instant sync).
 */
export function pushRelayStatus(): PushRelayStatus {
  const t = topic();
  if (!t) {
    return {
      configured: false,
      enabled: false,
      provider: "none",
      detail:
        "Scheduled polling via launchd. Gmail syncs on interval and at wake. " +
        "No always-on service required.",
    };
  }
  if (!enabled()) {
    return {
      configured: true,
      enabled: false,
      provider: "gmail-pubsub",
      detail:
        "Push relay configured but disabled (GMAIL_PUSH_ENABLED=0). " +
        "Using scheduled polling instead.",
      topic: t,
    };
  }
  return {
    configured: true,
    enabled: true,
    provider: "gmail-pubsub",
    detail:
      "Gmail push relay active. New mail triggers the same sync near-instantly, " +
      "in addition to scheduled polling.",
    topic: t,
  };
}
