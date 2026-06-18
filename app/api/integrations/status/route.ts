import { NextResponse } from "next/server";
import { allIntegrationStatuses } from "@/lib/integrations/registry";

/** Safe integration status - never returns secret values. */
export async function GET() {
  const integrations = await allIntegrationStatuses();
  return NextResponse.json({ integrations });
}
