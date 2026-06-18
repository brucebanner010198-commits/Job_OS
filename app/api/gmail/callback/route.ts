/**
 * GET /api/gmail/callback - Google redirects here with an authorization code.
 * Exchange it for tokens (stored locally, never in the DB), then bounce back to
 * /track with a status flag. The first sync lazily creates the GmailAccount row
 * with its historyId watermark.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getConfig, exchangeCode } from "@/lib/gmail/oauth";
import {
  GMAIL_OAUTH_STATE_COOKIE,
  verifyOAuthState,
} from "@/lib/gmail/oauth-state";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  const redirectError = (flag: string) => {
    const res = NextResponse.redirect(new URL(`/track?gmail=${flag}`, request.url));
    res.cookies.delete(GMAIL_OAUTH_STATE_COOKIE);
    return res;
  };

  if (error || !code || !state) {
    return redirectError("error");
  }

  const jar = await cookies();
  const cookieState = jar.get(GMAIL_OAUTH_STATE_COOKIE)?.value;
  if (!cookieState || cookieState !== state) {
    return redirectError("error");
  }

  const verified = verifyOAuthState(state);
  if (!verified) {
    return redirectError("error");
  }

  const cfg = await getConfig();
  if (!cfg) {
    return redirectError("unconfigured");
  }

  try {
    await exchangeCode(cfg, code, verified.profileId);
    const res = NextResponse.redirect(new URL("/track?gmail=connected", request.url));
    res.cookies.delete(GMAIL_OAUTH_STATE_COOKIE);
    return res;
  } catch {
    return redirectError("error");
  }
}
