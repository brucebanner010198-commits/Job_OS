/**
 * Runtime detection scan - pure decision core (Phase 5, plan §A).
 *
 * The real scanner (lib/apply/playwright-scanner.ts, not in scope here) maps
 * a live Playwright page into a PageSignals value by reading the DOM, script
 * sources, and visible text.  This function is the pure, offline, deterministic
 * classifier that decides whether the reduced signals indicate automation risk.
 *
 * Keeping the decision logic here (no Playwright import) means the entire
 * classification tree is unit-testable with zero browser / network setup.
 *
 * No LLM, no network, no DB, no Math.random/Date.now.
 */
import type { DetectionResult, PageSignals } from "@/lib/apply/types";

/**
 * Returns true when any string in `markers` contains at least one of the given
 * `substrings`.  All markers are assumed to be already lowercased (per the
 * PageSignals contract).
 */
function hasMarker(markers: string[], ...substrings: string[]): boolean {
  return markers.some((m) => substrings.some((s) => m.includes(s)));
}

/**
 * Scan a reduced page-signal object and return a DetectionResult.
 *
 * Fires one human-readable signal string per category of anti-automation
 * blocker found.  `clean` is true only when no signals fired.
 *
 * Categories checked (in order):
 *   1. reCAPTCHA       - markers include "recaptcha" or "g-recaptcha"
 *   2. hCaptcha        - markers include "hcaptcha"
 *   3. CF challenge    - markers include "turnstile", "cf-challenge",
 *                        "challenge-platform", or "checking your browser"
 *   4. Login wall      - signals.hasLoginForm === true OR markers include
 *                        "sign in", "log in", or "login-form"
 *   5. 2FA / OTP       - markers include "two-factor", "verification code",
 *                        or "one-time"
 *   6. Bot notice      - markers include "unusual traffic" or "bot detected"
 *   7. CAPTCHA flag    - signals.hasCaptcha === true and no CAPTCHA signal
 *                        already fired (driver saw a CAPTCHA element directly)
 *
 * Caller: lib/apply/engine.ts passes this result into RouteInput.detection so
 * the router can force ASSISTED or MANUAL when the page is not clean.
 */
export function scanPage(signals: PageSignals): DetectionResult {
  const found: string[] = [];
  const { markers, hasLoginForm, hasCaptcha } = signals;

  // 1. reCAPTCHA - "recaptcha" substring also matches "g-recaptcha"
  if (hasMarker(markers, "recaptcha", "g-recaptcha")) {
    found.push("reCAPTCHA detected");
  }

  // 2. hCaptcha
  if (hasMarker(markers, "hcaptcha")) {
    found.push("hCaptcha detected");
  }

  // 3. Cloudflare Turnstile / JS challenge page
  if (
    hasMarker(
      markers,
      "turnstile",
      "cf-challenge",
      "challenge-platform",
      "checking your browser",
    )
  ) {
    found.push("Cloudflare challenge detected");
  }

  // 4. Login / sign-in wall
  if (hasLoginForm || hasMarker(markers, "sign in", "log in", "login-form")) {
    found.push("login wall detected");
  }

  // 5. Two-factor / OTP gate
  if (hasMarker(markers, "two-factor", "verification code", "one-time")) {
    found.push("2FA/OTP gate detected");
  }

  // 6. Generic bot / unusual-traffic notice
  if (hasMarker(markers, "unusual traffic", "bot detected")) {
    found.push("bot detection notice");
  }

  // 7. Driver-level CAPTCHA flag - fires a generic signal when the driver
  //    detected a CAPTCHA element but no specific CAPTCHA marker matched above.
  if (hasCaptcha && !found.some((s) => s.toLowerCase().includes("captcha"))) {
    found.push("CAPTCHA detected");
  }

  return { clean: found.length === 0, signals: found };
}
