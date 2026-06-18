/**
 * Phase 4 validation gate - entailment-checked citation engine.
 *
 * Proves every verification rule is enforced correctly. No LLM, no network,
 * fully deterministic - composeBrief is pure and all inputs are fixtures.
 *
 * Run: npx tsx scripts/test-brief-compose.ts
 */

import { composeBrief } from "@/lib/brief/compose";
import { entails, entailmentScore } from "@/lib/brief/entailment";
import { classifyFact, isVolatile, isStale } from "@/lib/brief/volatile";
import { briefFixtures } from "@/lib/brief/sources";
import { FRESHNESS_DAYS } from "@/lib/brief/types";
import type { CandidateClaim } from "@/lib/brief/types";

// ---------------------------------------------------------------------------
// Test harness (matches test-goal-rerank.ts style)
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

// Test "now" - 2026-06-16, consistent with memory/project date.
const NOW = new Date("2026-06-16T00:00:00Z");

// ---------------------------------------------------------------------------
// Section 1 - entailment unit tests
// ---------------------------------------------------------------------------

console.log("\nentailment - basic overlap:");

const OFFICIAL_TEXT =
  "Acme AI is an enterprise artificial intelligence platform that helps businesses " +
  "automate decision-making workflows using machine learning. Founded in 2018, the " +
  "company provides AI-powered software tools for data analytics, predictive modeling, " +
  "and intelligent automation across industries including finance, healthcare, and retail.";

check(
  "claim well-covered by source → entailed",
  entails(
    "Acme AI is an enterprise artificial intelligence platform for automating workflows.",
    OFFICIAL_TEXT,
  ),
);

check(
  "completely unrelated claim → not entailed",
  !entails(
    "The stock market crashed in October 1929.",
    OFFICIAL_TEXT,
  ),
);

console.log("\nentailment - NUMBER MATCH (fabrication guard):");

const FUNDING_SOURCE =
  "Acme AI announced today that it has raised $50 million in a Series B funding round " +
  "led by General Catalyst. The round brings total funding to $75 million.";

check(
  "claim with correct number from source → entailed",
  entails("Acme AI raised $50 million in Series B funding.", FUNDING_SOURCE),
);

check(
  "claim with fabricated number absent from source → NOT entailed",
  !entails("Acme AI raised $200 million in Series B funding.", FUNDING_SOURCE),
);

check(
  "claim with fabricated headcount not in source → NOT entailed",
  !entails(
    "Acme AI has 5000 employees.",
    "Acme AI employs 1200 people across its engineering and operations teams.",
  ),
);

// Verify the entailmentScore for the correct-number case is high
check(
  "entailmentScore ≥ 0.70 for well-supported claim",
  entailmentScore("Acme AI raised $50 million in Series B funding.", FUNDING_SOURCE) >= 0.70,
);

console.log("\nentailment - NEGATION GUARD:");

check(
  "source negating the claim → NOT entailed",
  !entails(
    "Jane Smith is the current CEO of BetaCorp.",
    "Jane Smith is no longer the CEO of BetaCorp, having resigned last month.",
  ),
);

check(
  "source with 'former' near key term → NOT entailed",
  !entails(
    "Alice is the founder of Acme AI.",
    "Alice is a former founder who departed the company in 2022.",
  ),
);

// ---------------------------------------------------------------------------
// Section 2 - classifyFact and isVolatile
// ---------------------------------------------------------------------------

console.log("\nclassifyFact and isVolatile:");

check("funding keywords → 'funding'", classifyFact("Acme AI raised $50 million Series B") === "funding");
check("headcount keywords → 'headcount'", classifyFact("The company employs 1200 people") === "headcount");
check("leadership keywords → 'leadership'", classifyFact("Jane Smith was appointed CEO") === "leadership");
check("product keywords → 'product'", classifyFact("The platform provides predictive analytics") === "product");
check("funding is volatile", isVolatile("funding"));
check("headcount is volatile", isVolatile("headcount"));
check("leadership is volatile", isVolatile("leadership"));
check("overview is NOT volatile", !isVolatile("overview"));
check("product is NOT volatile", !isVolatile("product"));

// ---------------------------------------------------------------------------
// Section 3 - isStale
// ---------------------------------------------------------------------------

console.log("\nisStale:");

const recentDate = new Date("2026-05-01T00:00:00Z");   // ~46 days before NOW
const staleDate = new Date("2026-02-16T00:00:00Z");     // ~120 days before NOW

check(
  "recent source (46 days) → not stale",
  !isStale(recentDate, NOW),
);
check(
  `stale source (120 days > ${FRESHNESS_DAYS} days) → stale`,
  isStale(staleDate, NOW),
);
check(
  `exactly FRESHNESS_DAYS boundary (${FRESHNESS_DAYS} days) → not stale`,
  !isStale(new Date(NOW.getTime() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000), NOW),
);

// ---------------------------------------------------------------------------
// Section 4 - composeBrief: Acme AI (full pipeline)
// ---------------------------------------------------------------------------

console.log("\ncomposeBrief - Acme AI:");

const acmeSources = briefFixtures["Acme AI"];

const acmeCandidates: CandidateClaim[] = [
  // Rule: non-volatile, official source entails it → "verified"
  {
    text: "Acme AI is an enterprise artificial intelligence platform that automates decision-making workflows.",
    category: "overview",
  },
  // Rule: volatile funding with 2 independent primary sources → "verified"
  {
    text: "Acme AI raised $50 million in a Series B funding round.",
    category: "funding",
  },
  // Rule: wiki-only entailment (no primary entails this specific claim)
  // This claim is written to match only the wiki passage, not the official passages.
  {
    text: "Acme AI is a software company headquartered in San Francisco California.",
    category: "overview",
  },
  // Rule: no source entails this claim → refused
  {
    text: "Acme AI has 500 employees working in its offices.",
    category: "headcount",
  },
];

const acmeBrief = composeBrief({
  company: { name: "Acme AI", domain: "acmeai.com" },
  candidates: acmeCandidates,
  sources: acmeSources,
  now: NOW,
});

// Test: official-entailed overview claim → verified
const overviewClaim = acmeBrief.claims.find(
  (c) => c.category === "overview" && c.status === "verified",
);
check(
  "Acme AI overview claim entailed by official source → emitted as 'verified'",
  overviewClaim !== undefined,
);

// Test: volatile funding with 2 independent primary sources → verified
const fundingClaim = acmeBrief.claims.find((c) => c.category === "funding");
check(
  "Acme AI funding claim exists in claims (not refused)",
  fundingClaim !== undefined,
);
check(
  "Acme AI funding claim with 2 independent primary sources → 'verified'",
  fundingClaim?.status === "verified",
);
check(
  "Acme AI funding claim has secondSourceRequired=true (volatile)",
  fundingClaim?.secondSourceRequired === true,
);
check(
  "Acme AI funding claim sources include both primary sources",
  (fundingClaim?.sources.length ?? 0) >= 2,
);

// Test: no-source claim → refused
const refusedHeadcount = acmeBrief.refused.find((r) =>
  r.text.includes("500 employees"),
);
check(
  "Acme AI '500 employees' claim with no entailing source → in refused",
  refusedHeadcount !== undefined,
);
check(
  "'500 employees' NOT in emitted claims",
  !acmeBrief.claims.some((c) => c.text.includes("500 employees")),
);

// Test: wiki-only entailed claim - check it's never verified
// (may be refused or corroborated, but NEVER verified)
const sfClaim = acmeBrief.claims.find((c) => c.text.includes("San Francisco"));
const sfRefused = acmeBrief.refused.find((r) => r.text.includes("San Francisco"));
check(
  "Wiki-only entailed claim is never 'verified'",
  sfClaim?.status !== "verified",
);
// It should be either refused or not verified
check(
  "Wiki-only entailed claim is either refused or corroborated (never verified)",
  sfRefused !== undefined || (sfClaim !== undefined && sfClaim.status !== "verified"),
);

// Test: summary built from verified non-volatile overview/product claims only
check(
  "summary is a non-empty string when overview claim verified",
  acmeBrief.summary.length > 0,
);

// ---------------------------------------------------------------------------
// Section 5 - composeBrief: BetaCorp (single-source volatile + stale)
// ---------------------------------------------------------------------------

console.log("\ncomposeBrief - BetaCorp:");

const betaSources = briefFixtures["BetaCorp"];

const betaCandidates: CandidateClaim[] = [
  // Rule: volatile headcount, only ONE entailing source → "corroborated" (not verified)
  {
    text: "BetaCorp employs 1200 people across its engineering and operations teams.",
    category: "headcount",
  },
  // Rule: volatile leadership, stale source → "stale"
  {
    text: "Jane Smith was appointed CEO of BetaCorp.",
    category: "leadership",
  },
  // Rule: non-volatile, official source → "verified"
  {
    text: "BetaCorp is a cloud infrastructure company providing scalable compute and storage solutions.",
    category: "overview",
  },
];

const betaBrief = composeBrief({
  company: { name: "BetaCorp", domain: "betacorp.io" },
  candidates: betaCandidates,
  sources: betaSources,
  now: NOW,
});

// Test: volatile headcount with single source → NOT "verified"
const headcountClaim = betaBrief.claims.find((c) => c.category === "headcount");
check(
  "BetaCorp headcount claim exists (not fully refused)",
  headcountClaim !== undefined,
);
check(
  "BetaCorp headcount (single-source volatile) is NEVER 'verified'",
  headcountClaim?.status !== "verified",
);
check(
  "BetaCorp headcount is 'corroborated' (1 source, volatile)",
  headcountClaim?.status === "corroborated",
);
check(
  "BetaCorp headcount has secondSourceRequired=true",
  headcountClaim?.secondSourceRequired === true,
);

// Test: stale volatile leadership claim → "stale"
const leadershipClaim = betaBrief.claims.find((c) => c.category === "leadership");
check(
  "BetaCorp leadership claim exists",
  leadershipClaim !== undefined,
);
check(
  "BetaCorp leadership claim from stale source → status 'stale'",
  leadershipClaim?.status === "stale",
);
check(
  "BetaCorp leadership claim has stale=true",
  leadershipClaim?.stale === true,
);

// Test: non-volatile overview → verified
const betaOverview = betaBrief.claims.find((c) => c.category === "overview");
check(
  "BetaCorp overview claim → 'verified'",
  betaOverview?.status === "verified",
);

// ---------------------------------------------------------------------------
// Section 6 - cross-cutting invariants
// ---------------------------------------------------------------------------

console.log("\ncross-cutting invariants:");

// Every emitted claim has at least one source
check(
  "all emitted claims have at least one source",
  [...acmeBrief.claims, ...betaBrief.claims].every((c) => c.sources.length > 0),
);

// No claim in `claims` is also in `refused`
const acmeClaimTexts = new Set(acmeBrief.claims.map((c) => c.text));
check(
  "Acme AI: no overlap between claims and refused",
  acmeBrief.refused.every((r) => !acmeClaimTexts.has(r.text)),
);

// generatedAt matches input now
check(
  "Acme AI brief generatedAt equals input now",
  acmeBrief.generatedAt.getTime() === NOW.getTime(),
);
check(
  "BetaCorp brief generatedAt equals input now",
  betaBrief.generatedAt.getTime() === NOW.getTime(),
);

// All stale claims also have stale=true flag
check(
  "all 'stale' status claims have stale=true flag",
  [...acmeBrief.claims, ...betaBrief.claims]
    .filter((c) => c.status === "stale")
    .every((c) => c.stale === true),
);

// ---------------------------------------------------------------------------
// Final result
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
