/**
 * POST /api/gmail/push - the Gmail Pub/Sub push webhook (Phase 14). Google Pub/Sub
 * POSTs here when new mail arrives; we verify the shared secret, parse the
 * notification, and trigger the SAME idempotent sync the wake-poll runs. It only
 * PROPOSES status changes (never auto-applies) and never sends mail.
 *
 * Always ACKs with 2xx for authorized requests (even on a malformed/duplicate
 * push) so Pub/Sub doesn't retry-storm; unauthorized requests get 401. The relay
 * is off unless GMAIL_PUSH_TOKEN is set and GMAIL_PUSH_ENABLED isn't 0.
 */
import { getAppContext } from "@/lib/app-context";
import { syncInbox } from "@/lib/track/service";
import { parsePushEnvelope, verifyPushToken, pushToken } from "@/lib/gmail/push";

export async function POST(request: Request): Promise<Response> {
  // Master kill-switch.
  if (process.env.GMAIL_PUSH_ENABLED === "0") {
    return new Response(null, { status: 204 });
  }

  // Auth: Pub/Sub is configured to push with our shared secret as ?token=...
  // (an x-relay-token header is also accepted for manual testing).
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("token") ?? request.headers.get("x-relay-token");
  if (!verifyPushToken(provided, pushToken())) {
    return new Response("unauthorized", { status: 401 });
  }

  let body = "";
  try {
    body = await request.text();
  } catch {
    /* empty body */
  }
  const note = parsePushEnvelope(body);
  // Malformed/duplicate push → ACK and no-op (the wake-poll still catches up).
  if (!note) return new Response(null, { status: 204 });

  try {
    const { scope, user } = await getAppContext();
    await syncInbox(scope);
  } catch {
    // Never fail a push (avoid retry storms) - the next wake-poll catches up.
  }
  return new Response(null, { status: 204 });
}
