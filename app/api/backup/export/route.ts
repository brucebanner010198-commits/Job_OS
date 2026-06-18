/**
 * GET /api/backup/export - one-click portable export of the master profile as a
 * plaintext JSON download (Phase 11, Hardening §E: "one-click export"). This is
 * the user explicitly downloading their OWN data locally; it is never sent
 * anywhere. The at-rest encrypted snapshots live under /.backups; this endpoint
 * is the human-readable, portable copy.
 */
import { getAppContext } from "@/lib/app-context";
import { buildPlaintextExport } from "@/lib/backup/service";

export async function GET(): Promise<Response> {
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
