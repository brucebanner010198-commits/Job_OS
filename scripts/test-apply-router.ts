/**
 * Self-test for the apply autonomy router (Phase 5, Hardening §A).
 * Pure, offline, deterministic - no DB, no network, no LLM.
 * Run: npx tsx scripts/test-apply-router.ts
 */
import { routeApplication, autonomyBlockers } from "@/lib/apply/router";
import { TOLERANT_SURFACES, BLOCKED_SURFACES, classifySurface } from "@/lib/apply/surfaces";
import type {
  RouteInput,
  PreparedField,
  DetectionResult,
  KnockoutResult,
} from "@/lib/apply/types";

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

// --- Shared fixtures ----------------------------------------------------------

const cleanDetection: DetectionResult = { clean: true, signals: [] };
const dirtyDetection: DetectionResult = {
  clean: false,
  signals: ["recaptcha-v3"],
};

const notDisqualified: KnockoutResult = { disqualified: false, failures: [] };
const disqualifiedKO: KnockoutResult = {
  disqualified: true,
  failures: [{ requirement: "US work authorisation", reason: "requires sponsorship" }],
};

const noFields: PreparedField[] = [];

const criticalField: PreparedField = {
  key: "workAuthorization",
  label: "Work Authorization",
  value: "yes",
  source: "answers",
  confidence: 0.99,
  critical: true,
  freeText: false,
};

const freeTextField: PreparedField = {
  key: "coverLetter",
  label: "Cover Letter",
  value: "",
  source: "unknown",
  confidence: 0,
  critical: false,
  freeText: true,
};

/** The perfect AUTONOMOUS base - all six §A conditions satisfied. */
const autonomousBase: RouteInput = {
  surface: "dice",
  fields: noFields,
  detection: cleanDetection,
  knockouts: notDisqualified,
  local: true,
};

// --- Surface classification ---------------------------------------------------

console.log("\nsurface classification:");
check(
  "TOLERANT_SURFACES contains exactly the 5 expected keys",
  TOLERANT_SURFACES.has("dice") &&
    TOLERANT_SURFACES.has("wellfound") &&
    TOLERANT_SURFACES.has("email") &&
    TOLERANT_SURFACES.has("mailto") &&
    TOLERANT_SURFACES.has("company-simple") &&
    TOLERANT_SURFACES.size === 5,
);
check(
  "BLOCKED_SURFACES contains exactly linkedin and workday",
  BLOCKED_SURFACES.has("linkedin") &&
    BLOCKED_SURFACES.has("workday") &&
    BLOCKED_SURFACES.size === 2,
);
check('classifySurface("Dice") is tolerant (case-insensitive)', classifySurface("Dice") === "tolerant");
check('classifySurface("WORKDAY") is blocked (case-insensitive)', classifySurface("WORKDAY") === "blocked");
check('classifySurface("greenhouse") is standard', classifySurface("greenhouse") === "standard");
check('classifySurface("  Wellfound  ") normalises whitespace', classifySurface("  Wellfound  ") === "tolerant");
check('classifySurface("") is standard (unknown → safe)', classifySurface("") === "standard");

// --- AUTONOMOUS: all six conditions pass -------------------------------------

console.log("\nAUTONOMOUS - all six §A conditions satisfied:");
const autoResult = routeApplication(autonomousBase);
check("tolerant surface + clean + local + no critical + no freeText + not disqualified → AUTONOMOUS", autoResult.route === "AUTONOMOUS");
check("AUTONOMOUS reasons mention 'all autonomy conditions met'", autoResult.reasons.some((r) => r.includes("all autonomy conditions met")));
check("autonomyBlockers is EMPTY when route is AUTONOMOUS", autonomyBlockers(autonomousBase).length === 0);

// Test all TOLERANT surfaces reach AUTONOMOUS
for (const surf of ["dice", "wellfound", "email", "mailto", "company-simple"]) {
  const r = routeApplication({ ...autonomousBase, surface: surf });
  check(`surface '${surf}' → AUTONOMOUS`, r.route === "AUTONOMOUS");
}

// --- ASSISTED: single blocker cases ------------------------------------------

console.log("\nASSISTED - single-blocker cases (autonomousBase with one change):");

const withCritical = routeApplication({ ...autonomousBase, fields: [criticalField] });
check("one critical field → ASSISTED", withCritical.route === "ASSISTED");
check("critical-field ASSISTED reason names the field key", withCritical.reasons.some((r) => r.includes("workAuthorization")));

const withFreeText = routeApplication({ ...autonomousBase, fields: [freeTextField] });
check("one freeText field → ASSISTED", withFreeText.route === "ASSISTED");
check("freeText ASSISTED reason mentions free-text", withFreeText.reasons.some((r) => r.toLowerCase().includes("free-text")));

const withDirtyDetection = routeApplication({ ...autonomousBase, detection: dirtyDetection });
check("detection.clean=false → ASSISTED", withDirtyDetection.route === "ASSISTED");
check("dirty-detection ASSISTED reason mentions recaptcha", withDirtyDetection.reasons.some((r) => r.includes("recaptcha-v3")));

const withCloud = routeApplication({ ...autonomousBase, local: false });
check("local=false (cloud) → ASSISTED - never AUTONOMOUS on cloud", withCloud.route === "ASSISTED");
check("cloud ASSISTED reason mentions 'cloud execution'", withCloud.reasons.some((r) => r.toLowerCase().includes("cloud execution")));

const withStandardSurface = routeApplication({ ...autonomousBase, surface: "greenhouse" });
check("standard surface 'greenhouse' → ASSISTED (invisible reCAPTCHA, never autonomous)", withStandardSurface.route === "ASSISTED");

// --- ASSISTED: autonomyBlockers non-empty for all ASSISTED cases --------------

console.log("\nautonomyBlockers non-empty for all ASSISTED inputs:");
check("critical field → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, fields: [criticalField] }).length > 0);
check("freeText field → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, fields: [freeTextField] }).length > 0);
check("dirty detection → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, detection: dirtyDetection }).length > 0);
check("local=false → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, local: false }).length > 0);
check("standard surface → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, surface: "greenhouse" }).length > 0);

// --- MANUAL: blocked surfaces -------------------------------------------------

console.log("\nMANUAL - blocked surfaces:");

const linkedinResult = routeApplication({ ...autonomousBase, surface: "linkedin" });
check("surface 'linkedin' → MANUAL", linkedinResult.route === "MANUAL");
check("linkedin MANUAL reason mentions 'blocked'", linkedinResult.reasons.some((r) => r.includes("blocked")));
check("linkedin MANUAL reason mentions surface name", linkedinResult.reasons.some((r) => r.includes("linkedin")));

const workdayResult = routeApplication({ ...autonomousBase, surface: "workday" });
check("surface 'workday' → MANUAL", workdayResult.route === "MANUAL");
check("workday MANUAL reason mentions 'blocked'", workdayResult.reasons.some((r) => r.includes("blocked")));

// Blocked surface overrides clean/local/no-critical conditions
const blockedWithEverythingElseClean = routeApplication({
  surface: "linkedin",
  fields: noFields,
  detection: cleanDetection,
  knockouts: notDisqualified,
  local: true,
});
check("linkedin with clean/local/no-fields → still MANUAL (blocked wins)", blockedWithEverythingElseClean.route === "MANUAL");

// --- MANUAL: knockout disqualification ---------------------------------------

console.log("\nMANUAL - knockout disqualification:");

const knockedOut = routeApplication({ ...autonomousBase, knockouts: disqualifiedKO });
check("disqualified=true + tolerant surface → MANUAL (knockout first)", knockedOut.route === "MANUAL");
check("knockout MANUAL reason mentions 'disqualified'", knockedOut.reasons.some((r) => r.includes("disqualified")));
check("knockout MANUAL reason includes the failure requirement", knockedOut.reasons.some((r) => r.includes("US work authorisation")));

// Disqualified overrides everything - even a perfect AUTONOMOUS candidate
check(
  "disqualified + tolerant + clean + local + no fields → MANUAL (disqualification trumps all)",
  routeApplication({ ...autonomousBase, knockouts: disqualifiedKO }).route === "MANUAL",
);

// Disqualified overrides blocked surface check order (knockout is checked first)
const disqualifiedOnLinkedin = routeApplication({
  surface: "linkedin",
  fields: noFields,
  detection: cleanDetection,
  knockouts: disqualifiedKO,
  local: true,
});
check("disqualified on linkedin → MANUAL (knockout wins, reason reflects it)", disqualifiedOnLinkedin.route === "MANUAL");

// autonomyBlockers is non-empty for all MANUAL inputs
check("disqualified → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, knockouts: disqualifiedKO }).length > 0);
check("linkedin → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, surface: "linkedin" }).length > 0);
check("workday → autonomyBlockers non-empty", autonomyBlockers({ ...autonomousBase, surface: "workday" }).length > 0);

// --- Invariant: autonomyBlockers empty ↔ AUTONOMOUS --------------------------

console.log("\ninvariant: autonomyBlockers empty ↔ route is AUTONOMOUS:");
const testCases: Array<{ label: string; input: RouteInput }> = [
  { label: "perfect AUTONOMOUS base",              input: autonomousBase },
  { label: "critical field (ASSISTED)",            input: { ...autonomousBase, fields: [criticalField] } },
  { label: "freeText field (ASSISTED)",            input: { ...autonomousBase, fields: [freeTextField] } },
  { label: "dirty detection (ASSISTED)",           input: { ...autonomousBase, detection: dirtyDetection } },
  { label: "cloud (ASSISTED)",                     input: { ...autonomousBase, local: false } },
  { label: "standard surface greenhouse (ASSISTED)", input: { ...autonomousBase, surface: "greenhouse" } },
  { label: "linkedin (MANUAL)",                    input: { ...autonomousBase, surface: "linkedin" } },
  { label: "workday (MANUAL)",                     input: { ...autonomousBase, surface: "workday" } },
  { label: "disqualified (MANUAL)",                input: { ...autonomousBase, knockouts: disqualifiedKO } },
];

for (const { label, input } of testCases) {
  const route = routeApplication(input).route;
  const blockersEmpty = autonomyBlockers(input).length === 0;
  const expectAutonomous = route === "AUTONOMOUS";
  check(
    `'${label}': blockers.length===0 iff AUTONOMOUS [route=${route}]`,
    blockersEmpty === expectAutonomous,
  );
}

// --- Edge cases ---------------------------------------------------------------

console.log("\nedge cases:");

// Multiple blockers all reported
const multiBlocker = routeApplication({
  ...autonomousBase,
  local: false,
  fields: [criticalField, freeTextField],
  detection: dirtyDetection,
});
check("multiple blockers → ASSISTED with all reasons populated", multiBlocker.route === "ASSISTED" && multiBlocker.reasons.length >= 3);

// Empty fields array is fine
const emptyFields = routeApplication({ ...autonomousBase, fields: [] });
check("empty fields array → AUTONOMOUS (no critical/freeText)", emptyFields.route === "AUTONOMOUS");

// Uppercase surface normalised → still hits the right tier
const upperLinkedin = routeApplication({ ...autonomousBase, surface: "LinkedIn" });
check("'LinkedIn' (mixed case) → MANUAL (normalised to blocked)", upperLinkedin.route === "MANUAL");

// --- Summary ------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
