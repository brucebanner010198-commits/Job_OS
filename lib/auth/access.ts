/**
 * Access control for non-localhost deployments (P0 hardening).
 *
 * Local dev on 127.0.0.1 / ::1 / localhost is always trusted - the app is
 * designed local-first. When JOB_OS_ACCESS_TOKEN is set, every protected API
 * route on a non-local host must present the same token (Bearer header or
 * ?token= query param).
 */

import type { NextRequest } from "next/server";

/** Constant-time string compare (edge-safe - no node:crypto). */
function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** HttpOnly cookie set by middleware when a valid access token is presented. */
export const ACCESS_TOKEN_COOKIE = "job_os_access";

/** True when the request targets a loopback interface. */
export function isLocalhostHost(host: string | null): boolean {
  if (!host) return false;
  const bare = host.split(":")[0]?.toLowerCase() ?? "";
  return LOCAL_HOSTS.has(bare);
}

/** Routes that must stay open for OAuth redirects (no access token). */
export const AUTH_EXEMPT_PATHS = new Set([
  "/api/gmail/auth",
  "/api/gmail/callback",
]);

/** API prefixes that require a token when not on localhost. */
export const PROTECTED_API_PREFIXES = [
  "/api/backup",
  "/api/gmail",
  "/api/integrations",
  "/api/apply",
];

export function accessTokenConfigured(): boolean {
  const t = process.env.JOB_OS_ACCESS_TOKEN?.trim();
  return Boolean(t && t.length > 0);
}

export function expectedAccessToken(): string | undefined {
  const t = process.env.JOB_OS_ACCESS_TOKEN?.trim();
  return t && t.length > 0 ? t : undefined;
}

/** Extract bearer / query token from a Request. */
export function readProvidedToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("token");
    if (q) {
      console.warn(
        "[job-os] Deprecation: ?token= query param leaks in logs/referrers; use Authorization: Bearer or job_os_access cookie instead.",
      );
      return q.trim();
    }
  } catch {
    /* ignore */
  }
  return request.headers.get("x-job-os-token")?.trim() ?? null;
}

/** Bearer / query / header / cookie token from a Next.js middleware request. */
export function readProvidedTokenFromNextRequest(
  request: NextRequest,
): string | null {
  const fromHeaders = readProvidedToken(request);
  if (fromHeaders) return fromHeaders;
  return request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
}

/** Read bearer / header / cookie token from Next.js `headers()`. */
export function readProvidedTokenFromHeaders(h: Headers): string | null {
  const auth = h.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  const header = h.get("x-job-os-token");
  if (header?.trim()) return header.trim();

  const cookie = h.get("cookie");
  if (cookie) {
    const prefix = `${ACCESS_TOKEN_COOKIE}=`;
    for (const part of cookie.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length));
      }
    }
  }
  return null;
}

/** True when a non-loopback request must present JOB_OS_ACCESS_TOKEN. */
export function accessRequiredForHost(host: string | null): boolean {
  return accessTokenConfigured() && !isLocalhostHost(host);
}

export function verifyAccessToken(provided: string | null): boolean {
  const expected = expectedAccessToken();
  if (!expected) return true;
  if (!provided) return false;
  if (provided.length !== expected.length) return false;
  return timingSafeEqualStrings(provided, expected);
}

/** Whether this pathname should be checked by middleware. */
export function isProtectedApiPath(pathname: string): boolean {
  if (AUTH_EXEMPT_PATHS.has(pathname)) return false;
  return PROTECTED_API_PREFIXES.some((p) => pathname.startsWith(p));
}
