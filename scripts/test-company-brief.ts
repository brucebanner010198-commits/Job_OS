/**
 * Phase 4 validation gate - proposeCandidates + composeBrief integration.
 *
 * Proves every claim verification rule holds end-to-end by running
 * proposeCandidates over briefFixtures and then composeBrief with a fixed
 * `now` consistent with the fixture dates (RECENT = 2026-05-01, STALE =
 * 2026-02-16, NOW = 2026-06-16).
 *
 * No LLM, no network, no DB - fully deterministic.
 * Run: npx tsx scripts/test-company-brief.ts
 *
 * Rules proved (plan §6 / Hardening §B):
 *   1. A claim entailed by an official/news source → status "verified".
 *   2. ADVERSARIAL: fabricated candidate (number absent from all sources) →
 *      REFUSED (in refused[], absent from claims[]).
 *   3. Volatile claim with ONE entailing primary source → never "verified".
 *   4. Volatile claim with TWO independent primary sources → "verified".
 *   5. Wiki-only-entailed claim → never "verified" (refused or corroborated).
 *   6. Volatile claim from source older than FRESHNESS_DAYS → status "stale".
 *   7. entails() returns false for a claim whose number is absent from source.
 */

import { composeBrief } from "@/lib/brief/compose";
import { entails } from "@/lib/brief/entailment";
import { briefFixtures } from "@/lib/brief/sources";
import { proposeCandidates } from "@/lib/brief/candidates";
import { FRESHNESS_DAYS } from "@/lib/brief/types";
import type { CandidateClaim } from "@/lib/brief/types";

// ---------------------------------------------------------------------------
// Harness - same check/pass/fail/exit(1) pattern as test-goal-rerank.ts
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

// ---------------------------------------------------------------------------
// Fixed "now" - 2026-06-16 is the current project date (and today's date per
// memory). STALE = 2026-02-16 is 120 days before → > FRESHNESS_DAYS (90).
// RECENT = 2026-05-01 is ~46 days before → within the freshness window.
// ---------------------------------------------------------------------------

const NOW = new Date("2026-06-16T00:00:00Z");

// ---------------------------------------------------------------------------
// Section 1 - proposeCandidates structure
// ---------------------------------------------------------------------------

console.log("\nproposeCandidates - structure:");

const acmeSources = briefFixtures["Acme AI"];
const betaSources = briefFixtures["BetaCorp"];

const acmeCandidates = proposeCandidates(acmeSources);
const betaCandidates = proposeCandidates(betaSources);

check(
  "proposeCandidates(Acme AI sources) returns a non-empty array",
  acmeCandidates.length > 0,
);
check(
  "proposeCandidates(BetaCorp sources) returns a non-empty array",
  betaCandidates.length > 0,
);
check(
  "every candidate has a non-empty text",
  [...acmeCandidates, ...betaCandidates].every((c) => c.text.length > 0),
);
check(
  "every candidate has a valid category",
  [...acmeCandidates, ...betaCandidates].every((c) =>
    [
      "overview",
      "product",
      "funding",
      "headcount",
      "leadership",
      "culture",
      "news",
      "other",
    ].includes(c.category),
  ),
);
check(
  "proposeCandidates deduplicates - result ≤ total sentences across sources",
  acmeCandidates.length <= acmeSources.reduce((n, s) => n + s.text.split(/(?<=[.!?])\s+/).length, 0),
);

// ---------------------------------------------------------------------------
// Section 2 - Rule 7: entails() rejects a fabricated number
// (tested directly before end-to-end composeBrief runs)
// ---------------------------------------------------------------------------

console.log("\nentails() - number guard (Rule 7):");

const FUNDING_SOURCE_TEXT =
  "Acme AI announced today that it has raised $50 million in a Series B funding round " +
  "led by General Catalyst. The round brings total funding to $75 million.";

check(
  "entails() - correct $50M claim → true",
  entails("Acme AI raised $50 million in Series B funding.", FUNDING_SOURCE_TEXT),
);
check(
  "entails() - fabricated $999 billion (absent from source) → false",
  !entails("Acme AI raised $999 billion in Series Z funding.", FUNDING_SOURCE_TEXT),
);
check(
  "entails() - fabricated $200M (different number, absent) → false",
  !entails("Acme AI raised $200 million in Series B funding.", FUNDING_SOURCE_TEXT),
);

// ---------------------------------------------------------------------------
// Section 3 - Acme AI end-to-end (Rules 1, 2, 4, 5)
// ---------------------------------------------------------------------------

console.log("\ncomposeBrief - Acme AI (Rules 1, 2, 4, 5):");

/**
 * Adversarial candidate injected into the candidates list.
 * The number $999 billion appears in NO Acme AI source - entailment will fail
 * at the number-match gate, so this MUST end up in refused[], never claims[].
 * This is the core anti-fabrication proof: composeBrief's entailment guard
 * blocks claims that a proposer (offline or LLM) might hallucinate.
 */
const ADVERSARIAL_CANDIDATE: CandidateClaim = {
  text: "Acme AI raised $999 billion in Series Z funding.",
  category: "funding",
};

const acmeCandidatesWithAdversarial: CandidateClaim[] = [
  ...acmeCandidates,
  ADVERSARIAL_CANDIDATE,
];

const acmeBrief = composeBrief({
  company: { name: "Acme AI", domain: "acmeai.com" },
  candidates: acmeCandidatesWithAdversarial,
  sources: acmeSources,
  now: NOW,
});

// --- Rule 1: A claim entailed by an official/news source → "verified" ---
const verifiedByPrimary = acmeBrief.claims.find(
  (c) =>
    c.status === "verified" &&
    c.sources.some((s) => s.kind === "official" || s.kind === "news"),
);
check(
  "Rule 1 - at least one claim entailed by official/news source has status 'verified'",
  verifiedByPrimary !== undefined,
);

// --- Rule 2: Adversarial fabricated candidate ($999 billion) → REFUSED ---
const adversarialInRefused = acmeBrief.refused.some((r) =>
  r.text.includes("$999 billion"),
);
const adversarialInClaims = acmeBrief.claims.some((c) =>
  c.text.includes("$999 billion"),
);
check(
  "Rule 2 - adversarial '$999 billion' claim IS in refused[]",
  adversarialInRefused,
);
check(
  "Rule 2 - adversarial '$999 billion' claim is NOT in claims[]",
  !adversarialInClaims,
);

// --- Rule 4: Volatile funding with TWO independent primary sources → "verified" ---
// The sentence "We are thrilled to announce Acme AI has raised $50 million in Series B
// funding." (from ACME_OFFICIAL_FUNDING) is entailed by BOTH the official press-release
// source (score 1.0) and the news source (score 0.78 > 0.70) → 2 primary sources → verified.
const verifiedFunding = acmeBrief.claims.find(
  (c) => c.category === "funding" && c.status === "verified",
);
check(
  "Rule 4 - volatile funding claim with 2 independent primary sources → 'verified'",
  verifiedFunding !== undefined,
);
check(
  "Rule 4 - verified funding claim has ≥2 sources listed",
  (verifiedFunding?.sources.length ?? 0) >= 2,
);

// --- Rule 5: Wiki-only claim → never "verified" (refused or corroborated only) ---
// "The company is headquartered in San Francisco, California." is extracted from
// ACME_WIKI. It has token overlap only with the wiki source (4/4 = 1.0) but not
// with any official or news source (scores < 0.70). Since no primary source
// entails it, composeBrief refuses it with "Only wiki/other sources entail this claim".
//
// NOTE: ACME_NEWS_FUNDING also contains "The San Francisco-based AI startup…"
// which IS entailed by the news primary source → "verified". That is correct
// behaviour. Our Rule 5 test specifically targets the wiki-only "headquartered"
// sentence and checks that NO claim sourced exclusively by wiki/other is verified.
const sfHeadquartersRefused = acmeBrief.refused.find(
  (r) => r.text.includes("San Francisco") && r.text.toLowerCase().includes("headquartered"),
);
check(
  "Rule 5 - wiki-only 'headquartered in San Francisco' sentence is in refused[]",
  sfHeadquartersRefused !== undefined,
);

const wikiOnlyVerifiedClaim = acmeBrief.claims.find(
  (c) =>
    c.status === "verified" &&
    c.sources.every((s) => s.kind === "wiki" || s.kind === "other"),
);
check(
  "Rule 5 - no claim sourced exclusively by wiki/other has status 'verified'",
  wikiOnlyVerifiedClaim === undefined,
);

// ---------------------------------------------------------------------------
// Section 4 - BetaCorp end-to-end (Rules 3 and 6)
// ---------------------------------------------------------------------------

console.log("\ncomposeBrief - BetaCorp (Rules 3, 6):");

const betaBrief = composeBrief({
  company: { name: "BetaCorp", domain: "betacorp.io" },
  candidates: betaCandidates,
  sources: betaSources,
  now: NOW,
});

// --- Rule 3: Volatile claim with ONE entailing primary source → never "verified" ---
// "BetaCorp, the cloud infrastructure startup, now employs 1200 people…"
// is entailed by BETACORP_NEWS_HEADCOUNT only (the official overview doesn't
// mention headcount). Volatile headcount with 1 primary → "corroborated".
const headcountClaim = betaBrief.claims.find((c) => c.category === "headcount");
check(
  "Rule 3 - BetaCorp headcount claim exists in claims[]",
  headcountClaim !== undefined,
);
check(
  "Rule 3 - volatile headcount with single source is NEVER 'verified'",
  headcountClaim?.status !== "verified",
);
check(
  "Rule 3 - volatile single-source headcount is 'corroborated'",
  headcountClaim?.status === "corroborated",
);
check(
  "Rule 3 - headcount claim has secondSourceRequired=true",
  headcountClaim?.secondSourceRequired === true,
);

// --- Rule 6: Volatile claim from stale source → status "stale" ---
// "BetaCorp today announced that Jane Smith has been appointed CEO…"
// is entailed by BETACORP_STALE_LEADERSHIP (retrievedAt = 2026-02-16,
// 120 days before NOW = 2026-06-16 > FRESHNESS_DAYS = 90).
const leadershipClaim = betaBrief.claims.find((c) => c.category === "leadership");
check(
  `Rule 6 - BetaCorp leadership claim exists (stale source = 120 days > ${FRESHNESS_DAYS})`,
  leadershipClaim !== undefined,
);
check(
  "Rule 6 - volatile leadership from stale source → status 'stale'",
  leadershipClaim?.status === "stale",
);
check(
  "Rule 6 - stale leadership claim has stale=true flag",
  leadershipClaim?.stale === true,
);

// ---------------------------------------------------------------------------
// Section 5 - Cross-cutting invariants
// ---------------------------------------------------------------------------

console.log("\ncross-cutting invariants:");

// Every emitted claim has at least one source
check(
  "all emitted claims have at least one source",
  [...acmeBrief.claims, ...betaBrief.claims].every((c) => c.sources.length > 0),
);

// No claim text appears in both claims[] and refused[]
const acmeClaimTexts = new Set(acmeBrief.claims.map((c) => c.text));
check(
  "Acme AI: no text overlap between claims[] and refused[]",
  acmeBrief.refused.every((r) => !acmeClaimTexts.has(r.text)),
);

// All "stale" status claims also have stale=true flag
check(
  "all 'stale' status claims have stale=true flag",
  [...acmeBrief.claims, ...betaBrief.claims]
    .filter((c) => c.status === "stale")
    .every((c) => c.stale === true),
);

// generatedAt equals input now for both briefs
check(
  "Acme AI brief generatedAt equals input now",
  acmeBrief.generatedAt.getTime() === NOW.getTime(),
);
check(
  "BetaCorp brief generatedAt equals input now",
  betaBrief.generatedAt.getTime() === NOW.getTime(),
);

// Adversarial candidate with fabricated number never slips through even when
// mixed into a larger candidate set produced by proposeCandidates
check(
  "adversarial candidate never appears in claims[] regardless of surrounding candidates",
  !acmeBrief.claims.some((c) => c.text.includes("999")),
);

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
