/**
 * Testable proxy gate for LAN auth + rate limiting on protected API routes.
 */
import {
  accessTokenConfigured,
  isLocalhostHost,
  isProtectedApiPath,
  verifyAccessToken,
} from "@/lib/auth/access";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type ProxyGateDecision =
  | { kind: "allow"; persistCookie?: string }
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; retryAfterSec: number };

export type ProxyGateInput = {
  pathname: string;
  host: string | null;
  providedToken: string | null;
  existingCookieToken?: string | null;
  clientIp?: string;
};

export function evaluateProxyGate(input: ProxyGateInput): ProxyGateDecision {
  const { pathname, host, providedToken, existingCookieToken, clientIp } = input;

  if (!isProtectedApiPath(pathname)) {
    return { kind: "allow" };
  }

  if (isLocalhostHost(host)) {
    return { kind: "allow" };
  }

  const rate = checkRateLimit(clientIp ?? "unknown");
  if (!rate.allowed) {
    return {
      kind: "rate_limited",
      retryAfterSec: rate.retryAfterSec ?? 60,
    };
  }

  if (!accessTokenConfigured()) {
    return { kind: "allow" };
  }

  if (!verifyAccessToken(providedToken)) {
    return { kind: "unauthorized" };
  }

  if (providedToken && existingCookieToken !== providedToken) {
    return { kind: "allow", persistCookie: providedToken };
  }

  return { kind: "allow" };
}
