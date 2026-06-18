import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  readProvidedTokenFromNextRequest,
} from "@/lib/auth/access";
import { evaluateProxyGate } from "@/lib/security/proxy-gate";
import { clientIpFromRequest } from "@/lib/security/rate-limit";

/**
 * Gate sensitive API routes when the app is exposed beyond localhost.
 * Set JOB_OS_ACCESS_TOKEN in production; loopback requests are always allowed.
 * Valid tokens in query/header are persisted to an httpOnly cookie for server actions.
 * LAN clients on protected prefixes are rate-limited (100 req/min per IP).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const provided = readProvidedTokenFromNextRequest(request);
  const existingCookie = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  const decision = evaluateProxyGate({
    pathname,
    host,
    providedToken: provided,
    existingCookieToken: existingCookie,
    clientIp: clientIpFromRequest(request),
  });

  if (decision.kind === "rate_limited") {
    return NextResponse.json(
      { error: "too_many_requests" },
      {
        status: 429,
        headers: { "Retry-After": String(decision.retryAfterSec) },
      },
    );
  }

  if (decision.kind === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const response = NextResponse.next();

  if (decision.persistCookie) {
    response.cookies.set(ACCESS_TOKEN_COOKIE, decision.persistCookie, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
