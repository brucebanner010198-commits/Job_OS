import { NextResponse } from "next/server";
import { probeOpenRouter } from "@/lib/integrations/openrouter-probe";

/** Probe configured integrations without returning secret values. */
export async function POST() {
  const openrouter = await probeOpenRouter();
  return NextResponse.json({ openrouter });
}
