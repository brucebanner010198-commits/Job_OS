/**
 * GET /api/backup/export - one-click portable export of the master profile as a
 * plaintext JSON download (Phase 11, Hardening §E: "one-click export"). This is
 * the user explicitly downloading their OWN data locally; it is never sent
 * anywhere. The at-rest encrypted snapshots live under /.backups; this endpoint
 * is the human-readable, portable copy.
 *
 * Default-deny on non-loopback hosts (SEC-11): LAN exposure without
 * JOB_OS_ACCESS_TOKEN must not leak a full plaintext profile.
 */
import { headers } from "next/headers";
import {
  accessTokenConfigured,
  isLocalhostHost,
  readProvidedTokenFromHeaders,
  verifyAccessToken,
} from "@/lib/auth/access";
import { getAppContext } from "@/lib/app-context";
import { buildPlaintextExport } from "@/lib/backup/service";

function unauthorizedExport(): Response {
  return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/** Block export off loopback unless a valid access token is configured and presented. */
async function assertExportAllowed(): Promise<Response | null> {
  const h = await headers();
  const host = h.get("host");
  if (isLocalhostHost(host)) return null;

  if (!accessTokenConfigured()) return unauthorizedExport();

  const provided = readProvidedTokenFromHeaders(h);
  if (!verifyAccessToken(provided)) return unauthorizedExport();

  return null;
}

export async function GET(): Promise<Response> {
  const denied = await assertExportAllowed();
  if (denied) return denied;

  try {
    const { scope } = await getAppContext();
    const exp = await buildPlaintextExport(scope);
    const stamp = exp.exportedAt.replace(/[-:T.Z]/g, "").slice(0, 14);
    const body = JSON.stringify(exp, null, 2);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="job-os-profile-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
