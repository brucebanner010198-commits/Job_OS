/**
 * POST /api/backup/restore - restore the master profile from a snapshot
 * (Phase 11). The service ALWAYS takes a pre-restore safety snapshot first, then
 * decrypts + integrity-checks the chosen backup before atomically replacing the
 * profile. A corrupt/tampered/wrong-key blob fails BEFORE the live data is
 * touched.
 */
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-context";
import { restoreBackup } from "@/lib/backup/service";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const backupId = typeof body?.backupId === "string" ? body.backupId : "";
    if (!backupId) {
      return NextResponse.json(
        { ok: false, error: "backupId is required." },
        { status: 400 },
      );
    }
    const { scope } = await getAppContext();
    const result = await restoreBackup(scope, backupId);
    return NextResponse.json(
      { ok: result.ok, result },
      { status: result.ok ? 200 : 400 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Restore failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
