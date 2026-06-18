/**
 * Self-test for Phase 10 (real Playwright apply driver). THIS IS THE
 * test:apply-driver gate. It verifies everything that CAN be checked without a
 * live browser - the pure selector strategy, the detection-signal mapping, and
 * the driver's orchestration + safety invariants - by injecting a FAKE browser
 * page (the real system-Chrome launcher is the only untested-here part).
 *
 *   A. Pure: field→selector candidates, raw-page→PageSignals marker detection.
 *   B. Driver: open→scan→fill→submit ordering, "fill only known values", the
 *      concurrency=1 no-double-submit throw, dry-run never clicks, teardown,
 *      and "must open() first" guards.
 *   C. Safety: the live detection scan feeds scanPage → a captcha/login page is
 *      NOT clean (the signal approveAndSubmit uses to ABORT before submit).
 * Run: npx tsx scripts/test-apply-driver.ts
 */
import {
  fieldSelectorCandidates,
  detectMarkers,
  buildSignals,
  playwrightDriver,
  type BrowserPage,
  type BrowserSession,
  type Launcher,
  type RawPage,
} from "@/lib/apply/driver-playwright";
import { scanPage } from "@/lib/apply/detection";
import type { PreparedField } from "@/lib/apply/types";

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

const field = (over: Partial<PreparedField>): PreparedField => ({
  key: "email",
  label: "Email",
  value: "a@b.com",
  source: "answers",
  confidence: 1,
  critical: false,
  freeText: false,
  ...over,
});

// A fake browser page that records calls, so we can assert orchestration.
function makeFake(raw: RawPage) {
  const calls = { filled: [] as { value: string }[], clicked: 0, closed: 0, attached: false };
  const page: BrowserPage = {
    url: () => raw.url,
    async readRaw() {
      return raw;
    },
    async fillField(_candidates, value) {
      calls.filled.push({ value });
      return true;
    },
    async clickSubmit() {
      calls.clicked++;
      return true;
    },
    async attachResumeFile() {
      calls.attached = true;
      return true;
    },
  };
  const launcher: Launcher = async (): Promise<BrowserSession> => ({
    page,
    close: async () => {
      calls.closed++;
    },
  });
  return { launcher, calls };
}

const cleanRaw: RawPage = {
  url: "https://boards.greenhouse.io/acme/jobs/123/apply",
  scriptSrcs: ["https://cdn.acme.com/app.js"],
  htmlLower: "<form><input name='email'></form>",
  hasPasswordField: false,
};
const captchaRaw: RawPage = {
  url: "https://jobs.example.com/apply",
  scriptSrcs: ["https://www.google.com/recaptcha/api.js"],
  htmlLower: "<div class='g-recaptcha'></div>",
  hasPasswordField: false,
};
const loginRaw: RawPage = {
  url: "https://example.com/login?redirect=/apply",
  scriptSrcs: [],
  htmlLower: "<input type='password'>",
  hasPasswordField: true,
};

// Wrapped in main() because tsx runs these gates as CJS (no top-level await).
async function main(): Promise<void> {
// ===========================================================================
// A. PURE - selector strategy + detection mapping
// ===========================================================================
console.log("\napply-driver - selector candidates (pure):");
const emailCands = fieldSelectorCandidates(field({ key: "email", label: "Email" }));
check("email maps to name synonyms", emailCands.some((c) => c.by === "name" && c.value === "candidate_email"));
check("email includes a label candidate", emailCands.some((c) => c.by === "label" && c.value === "Email"));
const unsafe = fieldSelectorCandidates(field({ key: "weird key!", label: "Weird" }));
check("unsafe key yields NO name/id selector (injection-safe)", !unsafe.some((c) => c.by === "name" || c.by === "id"));
check("unsafe key still has a label candidate", unsafe.some((c) => c.by === "label"));
check("no-label field yields no label/placeholder candidate", fieldSelectorCandidates(field({ key: "phone", label: "" })).every((c) => c.by === "name" || c.by === "id"));

console.log("\napply-driver - detection markers (pure):");
const cm = detectMarkers(captchaRaw);
check("recaptcha → hasCaptcha", cm.hasCaptcha && cm.markers.includes("recaptcha"));
const lm = detectMarkers(loginRaw);
check("password field / login url → hasLoginForm", lm.hasLoginForm);
const clean = detectMarkers(cleanRaw);
check("plain form → no captcha, no login", !clean.hasCaptcha && !clean.hasLoginForm);
check("cloudflare html → marker", detectMarkers({ ...cleanRaw, htmlLower: "checking your browser cloudflare" }).markers.includes("cloudflare"));

console.log("\napply-driver - buildSignals (pure):");
const sig = buildSignals(captchaRaw);
check("host parsed from url", sig.host === "jobs.example.com");
check("signals carry the captcha flag", sig.hasCaptcha === true);

// ===========================================================================
// B. DRIVER - orchestration + safety invariants (fake browser)
// ===========================================================================
console.log("\napply-driver - orchestration:");
{
  const { launcher, calls } = makeFake(cleanRaw);
  const d = playwrightDriver({ launcher });
  await d.open(cleanRaw.url);
  const scanned = await d.scan();
  check("scan() maps the live page to PageSignals", scanned.url === cleanRaw.url && scanned.hasCaptcha === false);

  await d.fill([
    field({ key: "email", value: "a@b.com", source: "answers" }),
    field({ key: "salaryExpectation", value: "", source: "unknown" }), // skipped (empty + unknown)
    field({ key: "phone", value: "555", source: "answers" }),
  ]);
  check("fill() fills only known, non-empty values (2 of 3)", calls.filled.length === 2);

  const attached = await d.attachResume?.("/tmp/resume.pdf");
  check("attachResume() uploads when seam present", attached === true && calls.attached);

  const r = await d.submit();
  check("submit() clicks once and returns ok", r.ok && calls.clicked === 1);

  let threwTwice = false;
  try {
    await d.submit();
  } catch {
    threwTwice = true;
  }
  check("submit() twice THROWS (concurrency=1, no double-submit)", threwTwice);

  await d.close?.();
  check("close() tears the session down", calls.closed === 1);
}

console.log("\napply-driver - dry run never submits:");
{
  const { launcher, calls } = makeFake(cleanRaw);
  const d = playwrightDriver({ launcher, dryRun: true });
  await d.open(cleanRaw.url);
  await d.scan();
  await d.fill([field({ value: "x", source: "answers" })]);
  const r = await d.submit();
  check("dry-run reports ok but NEVER clicks", r.ok && calls.clicked === 0 && /not submitted/i.test(r.detail ?? ""));
  check("dry-run still fills the form", calls.filled.length === 1);
}

console.log("\napply-driver - must open() before use:");
{
  const { launcher } = makeFake(cleanRaw);
  const d = playwrightDriver({ launcher });
  let threw = false;
  try {
    await d.scan();
  } catch {
    threw = true;
  }
  check("scan() before open() THROWS", threw);
}

// ===========================================================================
// C. SAFETY - live detection feeds the submit-time abort
// ===========================================================================
console.log("\napply-driver - live detection abort signal (scanPage):");
check("clean page → detection.clean (submit may proceed)", scanPage(buildSignals(cleanRaw)).clean === true);
check("captcha page → NOT clean (approveAndSubmit aborts)", scanPage(buildSignals(captchaRaw)).clean === false);
check("login page → NOT clean (approveAndSubmit aborts)", scanPage(buildSignals(loginRaw)).clean === false);

// ===========================================================================
  console.log(`\napply-driver ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
