/**
 * POST /api/backup/create - take a manual encrypted snapshot of the master
 * profile now (Phase 11). Manual backups always write (explicit user intent);
 * the encryption + disk write happen server-side in the backup service.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  accessTokenConfigured,
  isLocalhostHost,
  readProvidedTokenFromHeaders,
  verifyAccessToken,
} from "@/lib/auth/access";
import { getAppContext } from "@/lib/app-context";
import { createBackup } from "@/lib/backup/service";

async function assertBackupAccessAllowed(): Promise<Response | null> {
  const h = await headers();
  const host = h.get("host");
  if (isLocalhostHost(host)) return null;

  if (!accessTokenConfigured()) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const provided = readProvidedTokenFromHeaders(h);
  if (!verifyAccessToken(provided)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  return null;
}

export async function POST(request: Request): Promise<Response> {
  const denied = await assertBackupAccessAllowed();
  if (denied) return denied;
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
