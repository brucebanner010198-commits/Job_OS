/**
 * Defensive security regression gate.
 * Run: npm run test:security
 */
import { safeFetch } from "@/lib/brief/fetch-utils";
import {
  ACCESS_TOKEN_COOKIE,
  accessTokenConfigured,
  accessRequiredForHost,
  expectedAccessToken,
  isLocalhostHost,
  isProtectedApiPath,
  readProvidedTokenFromHeaders,
  readProvidedTokenFromNextRequest,
  verifyAccessToken,
} from "@/lib/auth/access";
import { allIntegrationStatuses } from "@/lib/integrations/registry";
import { scopeWhere } from "@/lib/profiles/scope";
import { evaluateProxyGate } from "@/lib/security/proxy-gate";
import {
  checkRateLimit,
  resetRateLimitsForTests,
  shouldRateLimitRequest,
} from "@/lib/security/rate-limit";
import { isPublicHttpUrl } from "@/lib/security/url";
import {
  requireAccessForMutation,
  requireAccessForRead,
} from "@/lib/auth/require-access";
import { NextRequest } from "next/server";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function main(): Promise<void> {
  console.log("\nsecurity - integration status API:");

  const statuses = await allIntegrationStatuses();
  check("status API returns entries", statuses.length >= 5);
  check(
    "status objects never include secret values",
    statuses.every(
      (s) =>
        !("value" in s) &&
        !("secret" in s) &&
        !JSON.stringify(s).match(/sk-[a-z0-9]/i),
    ),
  );

  console.log("\nsecurity - profile isolation:");

  const scopeA = { userId: "user-a", profileId: "profile-a" };
  const scopeB = { userId: "user-a", profileId: "profile-b" };
  const whereA = scopeWhere(scopeA);
  const whereB = scopeWhere(scopeB);
  check(
    "scopeWhere binds userId + profileId",
    whereA.userId === scopeA.userId &&
      whereA.profileId === scopeA.profileId &&
      whereB.profileId === scopeB.profileId,
  );
  check(
    "scopeWhere prevents cross-profile query bleed",
    JSON.stringify(whereA) !== JSON.stringify(whereB),
  );

  console.log("\nsecurity - SSRF guards:");

  check("blocks file:// scheme", !isPublicHttpUrl("file:///etc/passwd"));
  check("blocks javascript: scheme", !isPublicHttpUrl("javascript:alert(1)"));
  check("blocks loopback http", !isPublicHttpUrl("http://127.0.0.1/admin"));
  check("blocks RFC1918", !isPublicHttpUrl("http://192.168.1.1/"));
  check("blocks metadata IP", !isPublicHttpUrl("http://169.254.169.254/"));
  check("allows public https", isPublicHttpUrl("https://example.com/about"));
  check(
    "safeFetch refuses internal URL without network",
    (await safeFetch("http://127.0.0.1/secret")) === null,
  );

  console.log("\nsecurity - auth middleware helpers:");

  const prevToken = process.env.JOB_OS_ACCESS_TOKEN;
  process.env.JOB_OS_ACCESS_TOKEN = "test-access-token-xyz";
  check("access token configured when env set", accessTokenConfigured());
  check(
    "protected paths include integrations + apply",
    isProtectedApiPath("/api/integrations/status") &&
      isProtectedApiPath("/api/apply/session/abc") &&
      !isProtectedApiPath("/api/gmail/auth"),
  );
  check(
    "missing Host header is not treated as localhost",
    isLocalhostHost(null) === false,
  );
  check(
    "verifyAccessToken accepts valid bearer value",
    verifyAccessToken("test-access-token-xyz"),
  );
  check(
    "verifyAccessToken rejects wrong token",
    !verifyAccessToken("wrong-token"),
  );
  check(
    "verifyAccessToken rejects length-mismatch without throwing",
    !verifyAccessToken("short"),
  );

  console.log("\nsecurity - server action access gate:");

  check(
    "requireAccessForRead exported for LAN read actions",
    typeof requireAccessForRead === "function",
  );
  check(
    "requireAccessForMutation exported for LAN write actions",
    typeof requireAccessForMutation === "function",
  );

  check(
    "accessRequiredForHost on LAN when token set",
    accessRequiredForHost("192.168.1.10:3000"),
  );
  check(
    "access not required on loopback",
    !accessRequiredForHost("127.0.0.1:3000"),
  );
  check(
    "readProvidedTokenFromHeaders reads bearer",
    readProvidedTokenFromHeaders(
      new Headers({ authorization: "Bearer test-access-token-xyz" }),
    ) === "test-access-token-xyz",
  );
  check(
    "readProvidedTokenFromHeaders reads access cookie",
    readProvidedTokenFromHeaders(
      new Headers({ cookie: `${ACCESS_TOKEN_COOKIE}=cookie-token-value` }),
    ) === "cookie-token-value",
  );

  console.log("\nsecurity - proxy LAN auth gate:");

  resetRateLimitsForTests();
  const lanHost = "192.168.1.10:3000";
  const token = "test-access-token-xyz";

  check(
    "loopback bypasses gate on protected path",
    evaluateProxyGate({
      pathname: "/api/backup/export",
      host: "127.0.0.1:3000",
      providedToken: null,
    }).kind === "allow",
  );
  check(
    "missing Host header is not treated as loopback (401)",
    evaluateProxyGate({
      pathname: "/api/integrations/status",
      host: null,
      providedToken: null,
    }).kind === "unauthorized",
  );
  check(
    "LAN protected path without token returns 401",
    evaluateProxyGate({
      pathname: "/api/integrations/status",
      host: lanHost,
      providedToken: null,
    }).kind === "unauthorized",
  );
  check(
    "LAN protected path with Bearer token allows",
    evaluateProxyGate({
      pathname: "/api/apply/session/abc",
      host: lanHost,
      providedToken: token,
    }).kind === "allow",
  );
  check(
    "LAN protected path with access cookie allows",
    evaluateProxyGate({
      pathname: "/api/gmail/sync",
      host: lanHost,
      providedToken: token,
    }).kind === "allow",
  );
  check(
    "valid Bearer on LAN persists httpOnly cookie when absent",
    evaluateProxyGate({
      pathname: "/api/backup/export",
      host: lanHost,
      providedToken: token,
      existingCookieToken: null,
    }).persistCookie === token,
  );
  check(
    "valid Bearer skips cookie write when cookie already matches",
    evaluateProxyGate({
      pathname: "/api/backup/export",
      host: lanHost,
      providedToken: token,
      existingCookieToken: token,
    }).persistCookie === undefined,
  );
  check(
    "Gmail OAuth auth path stays exempt on LAN",
    evaluateProxyGate({
      pathname: "/api/gmail/auth",
      host: lanHost,
      providedToken: null,
    }).kind === "allow",
  );
  check(
    "non-protected path allows on LAN without token",
    evaluateProxyGate({
      pathname: "/api/health",
      host: lanHost,
      providedToken: null,
    }).kind === "allow",
  );

  const bearerReq = new NextRequest("http://192.168.1.10:3000/api/backup/export", {
    headers: {
      host: lanHost,
      authorization: `Bearer ${token}`,
    },
  });
  check(
    "readProvidedTokenFromNextRequest reads Bearer from middleware request",
    readProvidedTokenFromNextRequest(bearerReq) === token,
  );

  const cookieReq = new NextRequest("http://192.168.1.10:3000/api/integrations/status", {
    headers: {
      host: lanHost,
      cookie: `${ACCESS_TOKEN_COOKIE}=${token}`,
    },
  });
  check(
    "readProvidedTokenFromNextRequest reads access cookie from middleware request",
    readProvidedTokenFromNextRequest(cookieReq) === token,
  );

  console.log("\nsecurity - LAN rate limit:");

  resetRateLimitsForTests();
  check(
    "protected LAN paths are rate-limit candidates",
    shouldRateLimitRequest("/api/integrations/status", lanHost) &&
      !shouldRateLimitRequest("/api/integrations/status", "127.0.0.1:3000"),
  );

  const rateIp = "10.0.0.42";
  let allowed = 0;
  for (let i = 0; i < 100; i++) {
    if (checkRateLimit(rateIp).allowed) allowed++;
  }
  check("allows 100 requests per IP per minute", allowed === 100);
  check(
    "blocks the 101st request from the same IP",
    !checkRateLimit(rateIp).allowed,
  );
  check(
    "rate limit returns retry-after seconds",
    (checkRateLimit(rateIp).retryAfterSec ?? 0) >= 1,
  );
  check(
    "different IPs have independent buckets",
    checkRateLimit("10.0.0.99").allowed,
  );
  check(
    "LAN gate returns rate_limited after quota exhausted",
    evaluateProxyGate({
      pathname: "/api/backup/export",
      host: lanHost,
      providedToken: token,
      clientIp: rateIp,
    }).kind === "rate_limited",
  );
  resetRateLimitsForTests();

  if (prevToken === undefined) delete process.env.JOB_OS_ACCESS_TOKEN;
  else process.env.JOB_OS_ACCESS_TOKEN = prevToken;
  check("expectedAccessToken unset when env cleared", !expectedAccessToken());

  console.log(`\nsecurity ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
