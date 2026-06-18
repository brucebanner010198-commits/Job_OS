import { NextResponse } from "next/server";

/** Legacy `/onboarding` hub → consolidated `/setup` wizard (HTTP redirect, not RSC). */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/setup", request.url), 308);
}
