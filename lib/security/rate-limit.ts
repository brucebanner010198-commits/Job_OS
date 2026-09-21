/**
 * In-memory per-IP rate limit for LAN-exposed protected API routes.
 * Fixed window: 100 requests per minute per client IP.
 */

import type { NextRequest } from "next/server";
import { isLocalhostHost, isProtectedApiPath } from "@/lib/auth/access";

const DEFAULT_LIMIT = 100;
const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSec?: number;
  remaining?: number;
};

function sanitizeIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const trimmed = ip.trim().slice(0, 45); // Max IPv6 string length
  return /^[a-f0-9:.]+$/i.test(trimmed) ? trimmed : "unknown";
}

/** Best-effort client IP from request and proxy headers (LAN / reverse-proxy safe). */
export function clientIpFromRequest(request: NextRequest): string {
  const directIp = (request as unknown as { ip?: string }).ip;
  if (directIp) return sanitizeIp(directIp);

  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return sanitizeIp(first);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return sanitizeIp(realIp);
  return "unknown";
}

/** True when this request should consume LAN rate-limit quota. */
export function shouldRateLimitRequest(
  pathname: string,
  host: string | null,
): boolean {
  return isProtectedApiPath(pathname) && !isLocalhostHost(host);
}

function pruneExpiredBuckets(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, b] of buckets.entries()) {
    if (now >= b.resetAt) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  ip: string,
  opts?: { limit?: number; windowMs?: number; now?: number },
): RateLimitResult {
  const cleanIp = sanitizeIp(ip);
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const now = opts?.now ?? Date.now();

  pruneExpiredBuckets(now);

  let bucket = buckets.get(cleanIp);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(cleanIp, bucket);
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  return { allowed: true, remaining: limit - bucket.count };
}

/** Clears in-memory buckets (test-only). */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
