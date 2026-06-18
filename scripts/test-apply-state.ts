/**
 * Self-test for the apply state machine and detection scan (Phase 5).
 * Pure, offline, deterministic. No LLM, no DB, no network.
 * Run: npx tsx scripts/test-apply-state.ts
 */
import {
  nextState,
  isTerminal,
  isAutoRetryable,
  resumeAction,
  legalEvents,
} from "@/lib/apply/state-machine";
import { scanPage } from "@/lib/apply/detection";
import type { PageSignals } from "@/lib/apply/types";

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

// --- State machine: happy path ------------------------------------------------

console.log("\nstate machine - happy path:");

check(
  "QUEUED --PREPARE--> PREPARING",
  nextState("QUEUED", "PREPARE") === "PREPARING",
);
check(
  "PREPARING --PREPARED--> REVIEW",
  nextState("PREPARING", "PREPARED") === "REVIEW",
);
check(
  "REVIEW --APPROVE--> SUBMITTING",
  nextState("REVIEW", "APPROVE") === "SUBMITTING",
);
check(
  "SUBMITTING --SUBMITTED_OK--> SUBMITTED",
  nextState("SUBMITTING", "SUBMITTED_OK") === "SUBMITTED",
);

// --- State machine: failure and reset path ------------------------------------

console.log("\nstate machine - failure + reset path:");

check(
  "SUBMITTING --SUBMITTED_FAIL--> FAILED",
  nextState("SUBMITTING", "SUBMITTED_FAIL") === "FAILED",
);
check(
  "FAILED --RESET--> QUEUED",
  nextState("FAILED", "RESET") === "QUEUED",
);

// --- State machine: illegal transitions return null ---------------------------

console.log("\nstate machine - illegal transitions (must be null):");

check(
  "nextState(QUEUED, APPROVE) === null  (can't skip PREPARING/REVIEW)",
  nextState("QUEUED", "APPROVE") === null,
);
check(
  "nextState(SUBMITTING, RESET) === null  (no manual retry while submitting)",
  nextState("SUBMITTING", "RESET") === null,
);
check(
  "nextState(SUBMITTED, RESET) === null  (terminal state)",
  nextState("SUBMITTED", "RESET") === null,
);
check(
  "nextState(QUEUED, SUBMITTED_OK) === null",
  nextState("QUEUED", "SUBMITTED_OK") === null,
);
check(
  "nextState(FAILED, APPROVE) === null",
  nextState("FAILED", "APPROVE") === null,
);

// --- Crash-safety invariant: SUBMITTING must never auto-retry -----------------

console.log("\ncrash-safety invariant (SUBMITTING):");

check(
  "isAutoRetryable(SUBMITTING) === false  [THE invariant]",
  isAutoRetryable("SUBMITTING") === false,
);
check(
  "resumeAction(SUBMITTING) === 'manual'  [scheduler must not re-fire]",
  resumeAction("SUBMITTING") === "manual",
);

// pre-submit states are safe to resume
check(
  "isAutoRetryable(QUEUED) === true",
  isAutoRetryable("QUEUED") === true,
);
check(
  "isAutoRetryable(PREPARING) === true",
  isAutoRetryable("PREPARING") === true,
);
check(
  "isAutoRetryable(REVIEW) === true",
  isAutoRetryable("REVIEW") === true,
);
// terminal states are not retried
check(
  "isAutoRetryable(SUBMITTED) === false",
  isAutoRetryable("SUBMITTED") === false,
);
check(
  "isAutoRetryable(FAILED) === false",
  isAutoRetryable("FAILED") === false,
);

// --- resumeAction coverage ----------------------------------------------------

console.log("\nresumeAction:");

check(
  "resumeAction(QUEUED) === 'resume'",
  resumeAction("QUEUED") === "resume",
);
check(
  "resumeAction(PREPARING) === 'resume'",
  resumeAction("PREPARING") === "resume",
);
check(
  "resumeAction(REVIEW) === 'resume'",
  resumeAction("REVIEW") === "resume",
);
check(
  "resumeAction(SUBMITTED) === 'done'",
  resumeAction("SUBMITTED") === "done",
);
check(
  "resumeAction(FAILED) === 'done'",
  resumeAction("FAILED") === "done",
);

// --- isTerminal ---------------------------------------------------------------

console.log("\nisTerminal:");

check("isTerminal(SUBMITTED) === true",  isTerminal("SUBMITTED") === true);
check("isTerminal(FAILED) === true",     isTerminal("FAILED") === true);
check("isTerminal(QUEUED) === false",    isTerminal("QUEUED") === false);
check("isTerminal(PREPARING) === false", isTerminal("PREPARING") === false);
check("isTerminal(REVIEW) === false",    isTerminal("REVIEW") === false);
check("isTerminal(SUBMITTING) === false",isTerminal("SUBMITTING") === false);

// --- legalEvents -------------------------------------------------------------

console.log("\nlegalEvents:");

check(
  "QUEUED has exactly [PREPARE]",
  legalEvents("QUEUED").length === 1 && legalEvents("QUEUED")[0] === "PREPARE",
);
check(
  "SUBMITTING has [SUBMITTED_OK, SUBMITTED_FAIL, CAPTCHA_DETECTED]",
  legalEvents("SUBMITTING").includes("SUBMITTED_OK") &&
    legalEvents("SUBMITTING").includes("SUBMITTED_FAIL") &&
    legalEvents("SUBMITTING").includes("CAPTCHA_DETECTED") &&
    legalEvents("SUBMITTING").length === 3,
);
check(
  "PAUSED can RESUME_AI or TAKE_CONTROL",
  legalEvents("PAUSED").includes("RESUME_AI") &&
    legalEvents("PAUSED").includes("TAKE_CONTROL"),
);
check(
  "SUBMITTED has no legal events (terminal)",
  legalEvents("SUBMITTED").length === 0,
);

// --- Detection scan -----------------------------------------------------------

console.log("\ndetection scan:");

// reCAPTCHA via marker
const recaptchaSignals: PageSignals = {
  url: "https://example.com/apply",
  host: "example.com",
  markers: ["src/https://www.google.com/recaptcha/api.js", "data-sitekey=abc", "...g-recaptcha..."],
  hasLoginForm: false,
  hasCaptcha: false,
};
const recaptchaResult = scanPage(recaptchaSignals);
check(
  "markers with g-recaptcha → not clean",
  recaptchaResult.clean === false,
);
check(
  "markers with g-recaptcha → has a reCAPTCHA signal",
  recaptchaResult.signals.some((s) => s.toLowerCase().includes("recaptcha")),
);

// login wall via hasLoginForm flag
const loginSignals: PageSignals = {
  url: "https://example.com/login",
  host: "example.com",
  markers: [],
  hasLoginForm: true,
  hasCaptcha: false,
};
const loginResult = scanPage(loginSignals);
check(
  "hasLoginForm:true → not clean",
  loginResult.clean === false,
);
check(
  "hasLoginForm:true → has a login wall signal",
  loginResult.signals.some((s) => s.toLowerCase().includes("login")),
);

// benign page - no markers, no flags
const cleanSignals: PageSignals = {
  url: "https://example.com/jobs/apply",
  host: "example.com",
  markers: [],
  hasLoginForm: false,
  hasCaptcha: false,
};
const cleanResult = scanPage(cleanSignals);
check(
  "benign page → clean === true",
  cleanResult.clean === true,
);
check(
  "benign page → signals is empty array",
  cleanResult.signals.length === 0,
);

// hCaptcha
const hcaptchaSignals: PageSignals = {
  url: "https://example.com/apply",
  host: "example.com",
  markers: ["hcaptcha.com/1/api.js"],
  hasLoginForm: false,
  hasCaptcha: false,
};
const hcaptchaResult = scanPage(hcaptchaSignals);
check(
  "hcaptcha marker → not clean, hCaptcha signal",
  hcaptchaResult.clean === false &&
    hcaptchaResult.signals.some((s) => s.toLowerCase().includes("hcaptcha")),
);

// Cloudflare challenge
const cfSignals: PageSignals = {
  url: "https://example.com/apply",
  host: "example.com",
  markers: ["challenge-platform"],
  hasLoginForm: false,
  hasCaptcha: false,
};
const cfResult = scanPage(cfSignals);
check(
  "challenge-platform marker → Cloudflare signal",
  cfResult.clean === false &&
    cfResult.signals.some((s) => s.toLowerCase().includes("cloudflare")),
);

// hasCaptcha flag without a matching string marker
const captchaFlagSignals: PageSignals = {
  url: "https://example.com/apply",
  host: "example.com",
  markers: [],
  hasLoginForm: false,
  hasCaptcha: true,
};
const captchaFlagResult = scanPage(captchaFlagSignals);
check(
  "hasCaptcha:true → not clean",
  captchaFlagResult.clean === false,
);
check(
  "hasCaptcha:true → signals includes a CAPTCHA entry",
  captchaFlagResult.signals.some((s) => s.toLowerCase().includes("captcha")),
);

// login wall via marker text (not flag)
const loginMarkerSignals: PageSignals = {
  url: "https://example.com/",
  host: "example.com",
  markers: ["sign in to apply"],
  hasLoginForm: false,
  hasCaptcha: false,
};
const loginMarkerResult = scanPage(loginMarkerSignals);
check(
  '"sign in" marker → login wall signal',
  loginMarkerResult.clean === false &&
    loginMarkerResult.signals.some((s) => s.toLowerCase().includes("login")),
);

// 2FA / OTP gate
const twoFaSignals: PageSignals = {
  url: "https://example.com/apply",
  host: "example.com",
  markers: ["enter your one-time code"],
  hasLoginForm: false,
  hasCaptcha: false,
};
const twoFaResult = scanPage(twoFaSignals);
check(
  '"one-time" marker → 2FA signal',
  twoFaResult.clean === false &&
    twoFaResult.signals.some((s) => s.toLowerCase().includes("2fa")),
);

// --- Summary -----------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
