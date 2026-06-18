/**
 * Gmail watch registration (Phase 14).
 *   POST   /api/gmail/watch  → register the INBOX → Pub/Sub-topic watch
 *   DELETE /api/gmail/watch  → stop it
 *
 * A Gmail watch expires after ~7 days, so re-POST periodically (e.g. from the
 * launchd catch-up agent) to keep the push relay alive. Both calls degrade
 * gracefully - they report a reason instead of throwing when Gmail isn't
 * connected or no topic is configured.
 */
import { NextResponse } from "next/server";
import { startGmailWatch, stopGmailWatch } from "@/lib/gmail/push";

export async function POST(): Promise<Response> {
  const r = await startGmailWatch();
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}

export async function DELETE(): Promise<Response> {
  const r = await stopGmailWatch();
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
