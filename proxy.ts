import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenConfigured,
  accessRequiredForHost,
  isLocalhostHost,
  isProtectedApiPath,
  readProvidedToken,
  verifyAccessToken,
} from "@/lib/auth/access";

/**
 * Gate sensitive API routes when the app is exposed beyond localhost.
 * Set JOB_OS_ACCESS_TOKEN in production; loopback requests are always allowed.
 * Valid tokens in query/header are persisted to an httpOnly cookie for server actions.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host");
  const provided = readProvidedToken(request);
  const valid = verifyAccessToken(provided);

  let response = NextResponse.next();

  if (accessRequiredForHost(host) && valid && provided) {
    const existing = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    if (existing !== provided) {
      response.cookies.set(ACCESS_TOKEN_COOKIE, provided, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
  }

  if (!isProtectedApiPath(pathname)) {
    return response;
  }

  if (!accessTokenConfigured()) {
    return response;
  }

  if (isLocalhostHost(host)) {
    return response;
  }

  if (!valid) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
