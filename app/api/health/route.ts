/**
 * GET /api/health — readiness snapshot for local ops and setup UX (Phase 4A).
 * Public on loopback; not in PROTECTED_API_PREFIXES (see test-security).
 */
import { NextResponse } from "next/server";
import pkg from "@/package.json";
import { pingDatabase } from "@/lib/db-health";
import { allIntegrationStatuses } from "@/lib/integrations/registry";

export async function GET(): Promise<NextResponse> {
  const [dbHealth, integrations] = await Promise.all([
    pingDatabase(),
    allIntegrationStatuses(),
  ]);

  const configured = integrations.filter((i) => i.configured).length;
  const enabled = integrations.filter((i) => i.enabled).length;

  const status = dbHealth.ok ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      db: dbHealth,
      integrations: {
        total: integrations.length,
        configured,
        enabled,
        items: integrations,
      },
      version: pkg.version,
    },
    {
      status: dbHealth.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
