/**
 * Self-test for the follow-up cadence BRAIN (Phase 7, plan §10).
 * THIS IS THE test:followup gate. Pure, offline, deterministic: a constant NOW
 * is injected, so nothing depends on the wall clock.
 * Run: npx tsx scripts/test-followup.ts
 */
import { planFollowUps } from "@/lib/followup/cadence";
import { fixtureTimelines, FIXTURE_NOW } from "@/lib/followup/fixtures";
import type {
  ApplicationTimeline,
  FollowUp,
  FollowUpKind,
} from "@/lib/followup/types";

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

/** Same multiset of kinds, regardless of order. */
function sameKinds(a: FollowUpKind[], b: FollowUpKind[]): boolean {
  if (a.length !== b.length) return false;
  const as = [...a].sort();
  const bs = [...b].sort();
  return as.every((k, i) => k === bs[i]);
}

/** A string that re-serializes to itself through Date is a valid ISO instant. */
function isValidIso(value: string): boolean {
  const ms = Date.parse(value);
  return !Number.isNaN(ms) && new Date(ms).toISOString() === value;
}

/** Find a fixture timeline by its applicationId (throws if the corpus drifts). */
function timelineOf(applicationId: string): ApplicationTimeline {
  const f = fixtureTimelines.find(
    (x) => x.timeline.applicationId === applicationId,
  );
  if (!f) throw new Error(`fixture not found: ${applicationId}`);
  return f.timeline;
}

function plan(applicationId: string): FollowUp[] {
  return planFollowUps(timelineOf(applicationId), FIXTURE_NOW);
}

// --- 1. Every fixture yields exactly its expectedKinds -----------------------

console.log("\nfollowup - every fixture matches its ground-truth kinds:");
for (const f of fixtureTimelines) {
  const out = planFollowUps(f.timeline, FIXTURE_NOW);
  check(
    `${f.timeline.applicationId} → [${f.expectedKinds.join(", ")}]`,
    sameKinds(
      out.map((x) => x.kind),
      f.expectedKinds,
    ),
  );
}

// --- 2. Terminal stop: REJECTED yields nothing -------------------------------

console.log("\nfollowup - terminal status stops the cadence:");
check("REJECTED (app-figma) → [] (terminal stop)", plan("app-figma").length === 0);

// --- 3. Urgency: never nag early, surface the overdue ------------------------

console.log("\nfollowup - nudge urgency vs injected now:");
const coinbase = plan("app-coinbase");
check(
  "applied 2 days ago (app-coinbase) → nudge urgency 'upcoming'",
  coinbase.length === 1 && coinbase[0].urgency === "upcoming",
);
const stripe = plan("app-stripe");
check(
  "applied 8 days ago (app-stripe) → nudge urgency 'overdue' or 'due'",
  stripe.length === 1 &&
    (stripe[0].urgency === "overdue" || stripe[0].urgency === "due"),
);

// --- 4. Interview branch: thank-you window vs check-in -----------------------

console.log("\nfollowup - interview thank-you vs stale check-in:");
const vercel = plan("app-vercel");
check(
  "interviewed yesterday (app-vercel) → INTERVIEW_THANK_YOU",
  vercel.length === 1 && vercel[0].kind === "INTERVIEW_THANK_YOU",
);
const airbnb = plan("app-airbnb");
check(
  "interviewed 9 days ago (app-airbnb) → POST_INTERVIEW_CHECKIN",
  airbnb.length === 1 && airbnb[0].kind === "POST_INTERVIEW_CHECKIN",
);

// --- 5. Offer branch ---------------------------------------------------------

console.log("\nfollowup - offer acknowledgement:");
const datadog = plan("app-datadog");
check(
  "offer in hand (app-datadog) → OFFER_RESPONSE",
  datadog.length === 1 && datadog[0].kind === "OFFER_RESPONSE",
);

// --- 6. Every emitted nudge is a well-formed, grounded draft ------------------

console.log("\nfollowup - every emitted follow-up is a well-formed draft:");
for (const f of fixtureTimelines) {
  const out = planFollowUps(f.timeline, FIXTURE_NOW);
  for (const nudge of out) {
    const id = `${f.timeline.applicationId}/${nudge.kind}`;
    check(`${id}: non-empty draftBody`, nudge.draftBody.trim().length > 0);
    check(`${id}: non-empty rationale`, nudge.rationale.trim().length > 0);
    check(`${id}: valid ISO dueAt`, isValidIso(nudge.dueAt));
    check(
      `${id}: draftBody references the company`,
      nudge.draftBody.includes(f.timeline.company),
    );
    check(
      `${id}: draftSubject references the company`,
      nudge.draftSubject.includes(f.timeline.company),
    );
  }
}

// --- Summary -----------------------------------------------------------------

console.log(`\nfollowup ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
