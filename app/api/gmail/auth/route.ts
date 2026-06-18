/**
 * GET /api/gmail/auth - kick off the Google OAuth consent flow. Redirects the
 * browser to Google's consent screen; Google redirects back to the callback
 * route with an authorization code. No tokens are handled here.
 */

import { NextResponse } from "next/server";
import { getConfig, buildAuthUrl } from "@/lib/gmail/oauth";
import { getAppContext } from "@/lib/app-context";
import {
  createOAuthState,
  GMAIL_OAUTH_STATE_COOKIE,
} from "@/lib/gmail/oauth-state";

export async function GET(request: Request): Promise<Response> {
  const cfg = await getConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL("/track?gmail=unconfigured", request.url));
  }

  const { scope } = await getAppContext();
  const state = createOAuthState(scope.profileId);
  const response = NextResponse.redirect(buildAuthUrl(cfg, state));
  response.cookies.set(GMAIL_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/gmail",
    maxAge: 600,
  });
  return response;
}
