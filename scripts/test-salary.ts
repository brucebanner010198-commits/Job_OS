/**
 * Salary Negotiation Coach - validation gate (test:salary).
 *
 * Pure self-test: no LLM, no network, no DB, no clock.
 * Run: npx tsx scripts/test-salary.ts
 *
 * Proves:
 *   1. Below-market base + anchor → counter floored at the market base, capped
 *      at +MAX_UPLIFT_OVER_ANCHOR; the Base component is flagged belowMarket.
 *   2. Fair offer, NO anchor → counter is exactly base × (1 + DEFAULT_TARGET_UPLIFT),
 *      nothing is flagged below market, provenance holds.
 *   3. Competing offer → counter ≥ the competing base (floor); the competing
 *      offer leads both the talking points and the leverage notes.
 *   4. Provenance invariants on EVERY case: range brackets the counter, a
 *      walk-away note exists, the draft names the company, assumptions are
 *      populated, every suggested figure is finite & ≥ 0, and the counter never
 *      exceeds 1.5× the largest real input (proof nothing was invented).
 */

import { fixtureOffers } from "@/lib/salary/fixtures";
import { buildNegotiationPlan } from "@/lib/salary/negotiate";
import {
  DEFAULT_TARGET_UPLIFT,
  MAX_UPLIFT_OVER_ANCHOR,
} from "@/lib/salary/types";

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

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

const round = (n: number): number => Math.round(n);

// ---------------------------------------------------------------------------
// Locate the three named fixtures
// ---------------------------------------------------------------------------

const belowMarket = fixtureOffers.find((f) => f.offer.baseSalary === 150_000);
const fairNoAnchor = fixtureOffers.find((f) => f.offer.baseSalary === 200_000);
const competing = fixtureOffers.find((f) => f.anchor.hasCompetingOffer);

check("fixture: below-market case present", belowMarket !== undefined);
check("fixture: fair-no-anchor case present", fairNoAnchor !== undefined);
check("fixture: competing-offer case present", competing !== undefined);

// ---------------------------------------------------------------------------
// Case 1 - Below-market (base 150k, market 180k)
// ---------------------------------------------------------------------------

console.log("\nbelow-market (base 150k, market 180k):");

if (belowMarket) {
  const plan = buildNegotiationPlan(belowMarket.offer, belowMarket.anchor);
  const market = belowMarket.anchor.marketBase as number; // 180_000

  check(
    "counterBase >= market base (180000)",
    plan.counterBase >= market,
  );
  check(
    "counterBase <= market base capped at +MAX_UPLIFT_OVER_ANCHOR",
    plan.counterBase <= round(market * (1 + MAX_UPLIFT_OVER_ANCHOR)),
  );

  const base = plan.components.find((c) => c.name === "Base salary");
  check("Base component exists", base !== undefined);
  check(
    "Base component belowMarket === true",
    base?.belowMarket === true,
  );
}

// ---------------------------------------------------------------------------
// Case 2 - Fair offer, NO anchor (200k)
// ---------------------------------------------------------------------------

console.log("\nfair offer, NO anchor (200k):");

if (fairNoAnchor) {
  const plan = buildNegotiationPlan(fairNoAnchor.offer, fairNoAnchor.anchor);
  const expected = round(200_000 * (1 + DEFAULT_TARGET_UPLIFT)); // 224000

  check(
    `counterBase === round(200000 * (1 + DEFAULT_TARGET_UPLIFT)) (${expected})`,
    plan.counterBase === expected,
  );

  const base = plan.components.find((c) => c.name === "Base salary");
  check("Base component exists", base !== undefined);
  check(
    "Base component belowMarket === false (no anchor)",
    base?.belowMarket === false,
  );
  check("provenanceOk === true", plan.provenanceOk === true);
}

// ---------------------------------------------------------------------------
// Case 3 - Competing offer (160k, competingBase 185k)
// ---------------------------------------------------------------------------

console.log("\ncompeting offer (160k, competingBase 185k):");

if (competing) {
  const plan = buildNegotiationPlan(competing.offer, competing.anchor);
  const competingBase = competing.anchor.competingBase as number; // 185_000

  check(
    "counterBase >= competing base (185000)",
    plan.counterBase >= competingBase,
  );
  check(
    "leverageNotes mention a competing offer",
    plan.leverageNotes.some((n) => /competing offer/i.test(n)),
  );
  check(
    "talkingPoints[0] references the competing offer",
    plan.talkingPoints.length > 0 &&
      /competing offer/i.test(plan.talkingPoints[0]),
  );
}

// ---------------------------------------------------------------------------
// Case 4 - Provenance invariants on EVERY fixture
// ---------------------------------------------------------------------------

console.log("\nprovenance invariants (every case):");

for (const fx of fixtureOffers) {
  const label = fx.offer.company ?? "offer";
  const plan = buildNegotiationPlan(fx.offer, fx.anchor);

  check(
    `[${label}] counterRange.low <= counterBase <= counterRange.high`,
    plan.counterRange.low <= plan.counterBase &&
      plan.counterBase <= plan.counterRange.high,
  );
  check(
    `[${label}] walkAwayNote is non-empty`,
    plan.walkAwayNote.trim().length > 0,
  );
  check(
    `[${label}] draftMessage is non-empty and contains the company`,
    plan.draftMessage.trim().length > 0 &&
      (fx.offer.company === undefined ||
        plan.draftMessage.includes(fx.offer.company)),
  );
  check(
    `[${label}] assumptions are non-empty`,
    plan.assumptions.length > 0,
  );
  check(`[${label}] provenanceOk === true`, plan.provenanceOk === true);
  check(
    `[${label}] every component.suggested is finite and >= 0`,
    plan.components.every(
      (c) => Number.isFinite(c.suggested) && c.suggested >= 0,
    ),
  );

  const largestRealInput =
    Math.max(
      fx.offer.baseSalary,
      fx.anchor.marketBase ?? 0,
      fx.anchor.competingBase ?? 0,
    ) * 1.5;
  check(
    `[${label}] counterBase <= 1.5x largest real input (nothing invented)`,
    plan.counterBase <= largestRealInput,
  );
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

const total = passed + failed;
console.log(`\nsalary ${passed}/${total}`);
if (failed > 0) process.exit(1);
