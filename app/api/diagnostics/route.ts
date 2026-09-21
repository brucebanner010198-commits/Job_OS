/**
 * GET /api/diagnostics: Deep system diagnostic endpoint following Google SRE health patterns.
 * Performs real-time checks across database, file storage, secrets, and AI connectivity.
 */

import { NextResponse } from "next/server";
import { runSystemDiagnostics } from "@/lib/diagnostics/system-health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const report = await runSystemDiagnostics();
  const httpStatus = report.overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(report, {
    status: httpStatus,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
