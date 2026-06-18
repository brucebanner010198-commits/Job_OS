/**
 * Phase 5 VALIDATION GATE - Apply Engine (plan §8c / §A / §C verification).
 *
 * Pure, offline, deterministic. No DB, no LLM, no network.
 * Run: npx tsx scripts/test-apply.ts
 *
 * What this gate proves:
 *   §ROUTING    - AUTONOMOUS / ASSISTED / MANUAL routes produce correctly
 *   §KNOCKOUT   - disqualified → plan.nextState==="FAILED"; canSubmit===false
 *   §REVIEW     - freshly-prepared non-disqualified app parks at REVIEW (paused)
 *   §NO-DOUBLE  - simulatedDriver.submit() throws on second call; SUBMITTED→null
 *   §CRASH      - isAutoRetryable(SUBMITTING)===false; resumeAction==="manual"
 *   §HAPPY-PATH - full QUEUED→PREPARING→REVIEW→SUBMITTING→SUBMITTED walk
 */

import { buildApplyPlan, canSubmit } from "@/lib/apply/engine";
import { simulatedDriver } from "@/lib/apply/driver-simulated";
import { routeApplication } from "@/lib/apply/router";
import {
  nextState,
  isAutoRetryable,
  isTerminal,
  resumeAction,
} from "@/lib/apply/state-machine";
import { fixtureJobs } from "@/lib/jobs/sources/fixtures";
import type {
  ApplicationAnswersData,
  ApplyState,
  PreparedField,
  PageSignals,
  KnockoutResult,
  DetectionResult,
} from "@/lib/apply/types";

// --- Harness -----------------------------------------------------------------

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

// --- Shared fixtures ----------------------------------------------------------

// Fully-qualified candidate - no knockouts
const qualifiedAnswers: ApplicationAnswersData = {
  workAuthorized: true,
  requiresSponsorship: false,
  yearsExperience: 6,
  willingToRelocate: false,
  remoteOnly: true,
  locations: ["Remote"],
  salaryExpectation: 155000,
  salaryCurrency: "USD",
  noticePeriod: "2 weeks",
  hasClearance: false,
  linkedinUrl: "https://linkedin.com/in/sample",
  githubUrl: "https://github.com/sample",
  websiteUrl: "https://sample.dev",
  customAnswers: [],
};

// Candidate who requires sponsorship - triggers PaymentPro knockout
const sponsorshipAnswers: ApplicationAnswersData = {
  ...qualifiedAnswers,
  workAuthorized: true,
  requiresSponsorship: true, // PaymentPro "no sponsorship" → knockout
};

// Candidate who lacks clearance - triggers ClearPath knockout
const noClearanceAnswers: ApplicationAnswersData = {
  ...qualifiedAnswers,
  hasClearance: false, // ClearPath requires clearance → knockout
};

const sampleContact = {
  name: "Test User",
  email: "test@example.dev",
  phone: "+1 555 0100",
  location: "Remote",
};

const cleanSignals: PageSignals = {
  url: "https://example.com/apply",
  host: "example.com",
  markers: [],
  hasLoginForm: false,
  hasCaptcha: false,
};

// Look up fixture jobs we need
const novaSparkJob = fixtureJobs.find((j) => j.sourceId === "novaspark-jfd-001")!;
const clearPathJob = fixtureJobs.find((j) => j.sourceId === "clearpath-ise-005")!;
const paymentProJob = fixtureJobs.find((j) => j.sourceId === "paymentpro-sbe-006")!;
const linkedinJob  = fixtureJobs.find((j) => j.sourceId === "linkedin-67890")!;
const acmeGhJob    = fixtureJobs.find((j) => j.sourceId === "acme-sbe-001")!; // greenhouse

// --- §ROUTING -----------------------------------------------------------------

console.log("\n§ROUTING - AUTONOMOUS / ASSISTED / MANUAL");

// AUTONOMOUS via routeApplication directly (buildApplyPlan always adds critical
// fields from planFields, so AUTONOMOUS is structurally blocked there - this is
// intentional: the review gate is the safe default for every real application).
// We test AUTONOMOUS by crafting a RouteInput with no critical / freeText fields.
{
  const noKnockouts: KnockoutResult = { disqualified: false, failures: [] };
  const cleanDetect: DetectionResult = { clean: true, signals: [] };
  const nonCriticalFields: PreparedField[] = [
    {
      key: "fullName",
      label: "Full name",
      value: "Test User",
      source: "profile",
      confidence: 0.95,
      critical: false,
      freeText: false,
    },
    {
      key: "email",
      label: "Email",
      value: "test@example.dev",
      source: "profile",
      confidence: 0.95,
      critical: false,
      freeText: false,
    },
  ];

  const autoDecision = routeApplication({
    surface: "dice",           // TOLERANT surface
    fields: nonCriticalFields, // no critical, no freeText
    detection: cleanDetect,    // clean
    knockouts: noKnockouts,    // not disqualified
    local: true,               // running locally
  });
  check("ROUTING: AUTONOMOUS - dice surface, no critical/freeText, clean, local", autoDecision.route === "AUTONOMOUS");
  check("ROUTING: AUTONOMOUS reasons populated", autoDecision.reasons.length > 0);
}

// ASSISTED via buildApplyPlan (planFields always emits critical fields → guaranteed ASSISTED)
{
  const assistedPlan = buildApplyPlan({
    jobText: novaSparkJob.description,
    answers: qualifiedAnswers,
    contact: sampleContact,
    signals: cleanSignals,
    local: true,
    surface: "greenhouse", // standard surface (not tolerant, not blocked)
  });
  check("ROUTING: ASSISTED - standard surface (greenhouse), qualified candidate",
    assistedPlan.route === "ASSISTED",
  );
  check("ROUTING: ASSISTED → nextState REVIEW (not disqualified)",
    assistedPlan.nextState === "REVIEW",
  );
}

// MANUAL via blocked surface (linkedin)
{
  const manualLinkedinPlan = buildApplyPlan({
    jobText: linkedinJob.description,
    answers: qualifiedAnswers,
    contact: sampleContact,
    signals: cleanSignals,
    local: true,
    surface: "linkedin", // BLOCKED surface
  });
  check("ROUTING: MANUAL - linkedin surface (blocked)", manualLinkedinPlan.route === "MANUAL");
  check("ROUTING: MANUAL linkedin → nextState REVIEW (not disqualified)",
    manualLinkedinPlan.nextState === "REVIEW",
  );
}

// MANUAL via workday (blocked)
{
  const manualWorkdayDecision = routeApplication({
    surface: "workday",
    fields: [],
    detection: { clean: true, signals: [] },
    knockouts: { disqualified: false, failures: [] },
    local: true,
  });
  check("ROUTING: MANUAL - workday surface (blocked)", manualWorkdayDecision.route === "MANUAL");
}

// MANUAL via knockout (overrides everything)
{
  const knockoutManualPlan = buildApplyPlan({
    jobText: paymentProJob.description, // "must be authorized without sponsorship"
    answers: sponsorshipAnswers,         // requires sponsorship → knockout
    contact: sampleContact,
    signals: cleanSignals,
    local: true,
    surface: "greenhouse", // standard (would be ASSISTED if no knockout)
  });
  check("ROUTING: MANUAL + FAILED - knocked-out candidate forced to MANUAL",
    knockoutManualPlan.route === "MANUAL",
  );
  check("ROUTING: MANUAL + FAILED - nextState is FAILED (not REVIEW)",
    knockoutManualPlan.nextState === "FAILED",
  );
}

// --- §KNOCKOUT ----------------------------------------------------------------

console.log("\n§KNOCKOUT - disqualified candidate never reaches submit");

{
  const clearPathPlan = buildApplyPlan({
    jobText: clearPathJob.description, // requires security clearance
    answers: noClearanceAnswers,        // hasClearance: false
    contact: sampleContact,
    signals: cleanSignals,
    local: true,
    surface: "ashby",
  });
  check("KNOCKOUT: disqualified - plan.nextState === 'FAILED'",
    clearPathPlan.nextState === "FAILED",
  );
  check("KNOCKOUT: disqualified - plan.route === 'MANUAL'",
    clearPathPlan.route === "MANUAL",
  );
  check("KNOCKOUT: disqualified - knockouts.disqualified === true",
    clearPathPlan.knockouts.disqualified === true,
  );
  check("KNOCKOUT: disqualified - failures array non-empty",
    clearPathPlan.knockouts.failures.length > 0,
  );
  check("KNOCKOUT: canSubmit('FAILED') === false  [submit structurally blocked]",
    canSubmit("FAILED") === false,
  );
}

// Non-disqualified should park at REVIEW
{
  const qualifiedPlan = buildApplyPlan({
    jobText: novaSparkJob.description,
    answers: qualifiedAnswers,
    contact: sampleContact,
    signals: cleanSignals,
    local: true,
    surface: "greenhouse",
  });
  check("KNOCKOUT: qualified → plan.nextState === 'REVIEW'",
    qualifiedPlan.nextState === "REVIEW",
  );
  check("KNOCKOUT: qualified → knockouts.disqualified === false",
    qualifiedPlan.knockouts.disqualified === false,
  );
}

// --- §REVIEW GATE -------------------------------------------------------------

console.log("\n§REVIEW GATE - submit unreachable until REVIEW + APPROVE");

{
  // A freshly-prepared non-disqualified app is in REVIEW (paused for human)
  const plan = buildApplyPlan({
    jobText: acmeGhJob.description,
    answers: qualifiedAnswers,
    contact: sampleContact,
    signals: cleanSignals,
    local: true,
    surface: "greenhouse",
  });
  check("REVIEW GATE: freshly-prepared non-disqualified app → nextState REVIEW",
    plan.nextState === "REVIEW",
  );
  check("REVIEW GATE: canSubmit('REVIEW') === true  [only at REVIEW]",
    canSubmit("REVIEW") === true,
  );
  check("REVIEW GATE: canSubmit('QUEUED') === false",
    canSubmit("QUEUED") === false,
  );
  check("REVIEW GATE: canSubmit('PREPARING') === false",
    canSubmit("PREPARING") === false,
  );
  check("REVIEW GATE: canSubmit('SUBMITTING') === false  [in-flight, not paused]",
    canSubmit("SUBMITTING") === false,
  );
  check("REVIEW GATE: canSubmit('SUBMITTED') === false  [already done]",
    canSubmit("SUBMITTED") === false,
  );
  check("REVIEW GATE: canSubmit('FAILED') === false  [terminal]",
    canSubmit("FAILED") === false,
  );

  // Walk state machine to REVIEW and assert it's paused there
  const afterPrepare  = nextState("QUEUED",    "PREPARE");
  const afterPrepared = nextState("PREPARING", "PREPARED");
  check("REVIEW GATE: QUEUED --PREPARE--> PREPARING", afterPrepare === "PREPARING");
  check("REVIEW GATE: PREPARING --PREPARED--> REVIEW (paused for human)", afterPrepared === "REVIEW");

  // REVIEW requires an explicit APPROVE event to leave - not PREPARE, not RESET
  check("REVIEW GATE: nextState(REVIEW, PREPARE) === null  (can't re-prepare from REVIEW)",
    nextState("REVIEW", "PREPARE") === null,
  );
  check("REVIEW GATE: nextState(REVIEW, RESET) === null  (no reset from REVIEW)",
    nextState("REVIEW", "RESET") === null,
  );
  check("REVIEW GATE: nextState(REVIEW, APPROVE) === 'SUBMITTING'  (only APPROVE advances)",
    nextState("REVIEW", "APPROVE") === "SUBMITTING",
  );
}

// --- §NO-DOUBLE-SUBMIT --------------------------------------------------------

console.log("\n§NO-DOUBLE-SUBMIT - second submit() call throws; SUBMITTED has no outgoing");

{
  // simulatedDriver throws on second submit() call
  const driver = simulatedDriver();
  let firstOk = false;
  let secondThrew = false;

  // First submit - must succeed
  await driver.open("https://example.com/apply");
  await driver.scan();
  await driver.fill([]);
  const r1 = await driver.submit();
  firstOk = r1.ok;

  // Second submit - must throw (concurrency=1 invariant)
  try {
    await driver.submit();
  } catch {
    secondThrew = true;
  }

  check("NO-DOUBLE: first submit() → ok:true", firstOk === true);
  check("NO-DOUBLE: second submit() throws  [concurrency=1 invariant]", secondThrew === true);

  // State machine: SUBMITTED has no outgoing transitions
  check("NO-DOUBLE: nextState('SUBMITTED', 'APPROVE') === null  [can't re-approve a submitted app]",
    nextState("SUBMITTED", "APPROVE") === null,
  );
  check("NO-DOUBLE: nextState('SUBMITTED', 'PREPARE') === null",
    nextState("SUBMITTED", "PREPARE") === null,
  );
  check("NO-DOUBLE: isTerminal('SUBMITTED') === true",
    isTerminal("SUBMITTED") === true,
  );
}

// --- §CRASH-SAFETY ------------------------------------------------------------

console.log("\n§CRASH-SAFETY - SUBMITTING never auto-retried");

{
  check("CRASH: isAutoRetryable('SUBMITTING') === false  [THE invariant]",
    isAutoRetryable("SUBMITTING") === false,
  );
  check("CRASH: resumeAction('SUBMITTING') === 'manual'  [scheduler must not re-fire]",
    resumeAction("SUBMITTING") === "manual",
  );
  check("CRASH: nextState('SUBMITTING', 'RESET') === null  [no manual reset while in-flight]",
    nextState("SUBMITTING", "RESET") === null,
  );
  // Pre-submit states may be auto-resumed (no side-effect committed to employer)
  check("CRASH: isAutoRetryable('QUEUED') === true",    isAutoRetryable("QUEUED") === true);
  check("CRASH: isAutoRetryable('PREPARING') === true", isAutoRetryable("PREPARING") === true);
  check("CRASH: isAutoRetryable('REVIEW') === true",    isAutoRetryable("REVIEW") === true);
  // Terminal states need no resume
  check("CRASH: isAutoRetryable('SUBMITTED') === false", isAutoRetryable("SUBMITTED") === false);
  check("CRASH: isAutoRetryable('FAILED') === false",    isAutoRetryable("FAILED") === false);
}

// --- §HAPPY-PATH --------------------------------------------------------------

console.log("\n§HAPPY-PATH - full QUEUED → PREPARING → REVIEW → SUBMITTING → SUBMITTED");

{
  // Build plan for a non-disqualified job
  const plan = buildApplyPlan({
    jobText: novaSparkJob.description,
    answers: qualifiedAnswers,
    contact: sampleContact,
    signals: cleanSignals,
    local: true,
    surface: "greenhouse",
  });

  check("HAPPY-PATH: plan built without error", plan !== null);
  check("HAPPY-PATH: plan.nextState === 'REVIEW' (non-disqualified parks at REVIEW)",
    plan.nextState === "REVIEW",
  );
  check("HAPPY-PATH: fields non-empty", plan.fields.length > 0);

  // Walk the state machine manually (simulating the service layer without DB)
  let state: ApplyState = "QUEUED";

  state = nextState(state, "PREPARE") as ApplyState;
  check("HAPPY-PATH: QUEUED --PREPARE--> PREPARING", state === "PREPARING");

  // (prep runs here - plan already built above)
  state = nextState(state, "PREPARED") as ApplyState;
  check("HAPPY-PATH: PREPARING --PREPARED--> REVIEW", state === "REVIEW");

  // Human sees the review gate - canSubmit returns true
  check("HAPPY-PATH: canSubmit at REVIEW === true", canSubmit(state) === true);

  // Human approves
  state = nextState(state, "APPROVE") as ApplyState;
  check("HAPPY-PATH: REVIEW --APPROVE--> SUBMITTING", state === "SUBMITTING");

  // Execute driver: open → scan → fill → submit
  const driver = simulatedDriver();
  await driver.open(novaSparkJob.url ?? "https://example.com/apply");

  const scanned = await driver.scan();
  check("HAPPY-PATH: scan() returns PageSignals", typeof scanned.host === "string");

  await driver.fill(plan.fields);

  const submitResult = await driver.submit();
  check("HAPPY-PATH: submit() returns ok:true (not failSubmit)", submitResult.ok === true);

  // Advance state machine on success
  state = nextState(state, "SUBMITTED_OK") as ApplyState;
  check("HAPPY-PATH: SUBMITTING --SUBMITTED_OK--> SUBMITTED", state === "SUBMITTED");
  check("HAPPY-PATH: final state is terminal", isTerminal(state) === true);
  check("HAPPY-PATH: canSubmit after SUBMITTED === false", canSubmit(state) === false);
}

// --- §HAPPY-PATH-FAIL ---------------------------------------------------------

console.log("\n§HAPPY-PATH-FAIL - SUBMITTING → FAILED on driver failure");

{
  let state: ApplyState = "REVIEW";
  state = nextState(state, "APPROVE") as ApplyState;
  check("FAIL-PATH: REVIEW --APPROVE--> SUBMITTING", state === "SUBMITTING");

  const driver = simulatedDriver({ failSubmit: true });
  await driver.open("https://example.com/apply");
  await driver.scan();
  await driver.fill([]);
  const result = await driver.submit();
  check("FAIL-PATH: failSubmit driver → ok:false", result.ok === false);

  state = nextState(state, "SUBMITTED_FAIL") as ApplyState;
  check("FAIL-PATH: SUBMITTING --SUBMITTED_FAIL--> FAILED", state === "FAILED");
  check("FAIL-PATH: FAILED is terminal", isTerminal(state) === true);

  // Can reset from FAILED (but NOT from SUBMITTED)
  const resetState = nextState(state, "RESET");
  check("FAIL-PATH: FAILED --RESET--> QUEUED (retry path)", resetState === "QUEUED");
}

// --- Summary -----------------------------------------------------------------

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\nFATAL:", err);
  process.exit(1);
});
