/**
 * Gmail push relay (Phase 14, plan §9 - the ONE optional always-on cloud piece).
 * Turns the Phase 9 seam into a working relay: a Gmail `watch` publishes to a
 * Pub/Sub topic, Pub/Sub POSTs the local webhook (app/api/gmail/push), and the
 * webhook triggers the SAME idempotent sync the wake-poll runs - so an interview
 * invite is seen in seconds, not at the next wake.
 *
 * Safety: this NEVER weakens a guarantee - it only fires `syncInbox`, which still
 * PROPOSES status changes (never auto-applies) and never sends mail. The webhook
 * is protected by a shared secret (GMAIL_PUSH_TOKEN) so a random POST can't
 * trigger a sync. Pure parsing/verification lives here (gate-tested); the watch
 * calls are server-only and never throw.
 */
import { getAccessToken } from "@/lib/gmail/oauth";

const WATCH_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/watch";
const STOP_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/stop";

export interface PushNotification {
  emailAddress: string;
  historyId: string;
}

/** GMAIL_PUBSUB_TOPIC (projects/<p>/topics/<t>), or undefined. */
export function pushTopic(): string | undefined {
  const t = process.env.GMAIL_PUBSUB_TOPIC?.trim();
  return t ? t : undefined;
}

/** The shared secret the Pub/Sub push must present (?token=...), or undefined. */
export function pushToken(): string | undefined {
  const t = process.env.GMAIL_PUSH_TOKEN?.trim();
  return t ? t : undefined;
}

/**
 * Parse a Pub/Sub push request body into the Gmail notification. PURE.
 * Shape: { message: { data: <base64 JSON {emailAddress, historyId}> }, ... }.
 * Returns null on anything malformed (the webhook then just ACKs and no-ops).
 */
export function parsePushEnvelope(rawBody: string): PushNotification | null {
  let envelope: unknown;
  try {
    envelope = JSON.parse(rawBody);
  } catch {
    return null;
  }
  if (typeof envelope !== "object" || envelope === null) return null;
  const message = (envelope as Record<string, unknown>).message;
  if (typeof message !== "object" || message === null) return null;
  const dataB64 = (message as Record<string, unknown>).data;
  if (typeof dataB64 !== "string" || !dataB64) return null;

  let decoded: string;
  try {
    decoded = Buffer.from(dataB64, "base64").toString("utf8");
  } catch {
    return null;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const emailAddress = typeof p.emailAddress === "string" ? p.emailAddress : "";
  const historyId = p.historyId != null ? String(p.historyId) : "";
  if (!emailAddress || !historyId) return null;
  return { emailAddress, historyId };
}

/**
 * Constant-time-ish shared-secret check. PURE. Both sides must be present and
 * equal; an unset expected secret means the relay isn't armed → reject.
 */
export function verifyPushToken(
  provided: string | null | undefined,
  expected: string | undefined,
): boolean {
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

/** Register the INBOX → Pub/Sub-topic watch. Server-only; never throws. */
export async function startGmailWatch(): Promise<{
  ok: boolean;
  historyId?: string;
  expiration?: string;
  reason?: string;
}> {
  const topic = pushTopic();
  if (!topic) return { ok: false, reason: "GMAIL_PUBSUB_TOPIC not set" };
  const token = await getAccessToken();
  if (!token) return { ok: false, reason: "Gmail not connected" };
  try {
    const res = await fetch(WATCH_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ topicName: topic, labelIds: ["INBOX"] }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `watch failed (${res.status})` };
    const data = (await res.json()) as { historyId?: string; expiration?: string };
    return { ok: true, historyId: data.historyId, expiration: data.expiration };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "watch error" };
  }
}

/** Stop the mailbox watch. Server-only; never throws. */
export async function stopGmailWatch(): Promise<{ ok: boolean; reason?: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, reason: "Gmail not connected" };
  try {
    const res = await fetch(STOP_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    return res.ok ? { ok: true } : { ok: false, reason: `stop failed (${res.status})` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "stop error" };
  }
}
