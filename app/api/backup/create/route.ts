/**
 * POST /api/backup/create - take a manual encrypted snapshot of the master
 * profile now (Phase 11). Manual backups always write (explicit user intent);
 * the encryption + disk write happen server-side in the backup service.
 */
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-context";
import { createBackup } from "@/lib/backup/service";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json().catch(() => ({}));
    const label =
      typeof body?.label === "string" && body.label.trim()
        ? body.label.trim().slice(0, 120)
        : undefined;
    const { scope } = await getAppContext();
    const { record, deduped } = await createBackup(scope, {
      trigger: "manual",
      label,
      force: true,
    });
    return NextResponse.json({ ok: true, record, deduped });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backup failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
