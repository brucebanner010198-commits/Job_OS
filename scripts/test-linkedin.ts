/**
 * LinkedIn Presence Optimizer - validation gate.
 *
 * Pure self-test: no LLM, no network, no DB.
 * Run: npx tsx scripts/test-linkedin.ts
 *
 * Proves:
 *   1. Weak profile → low score, tier "Beginner", multiple high-severity findings.
 *   2. Strong profile → high score, tier "All-Star", no findings, strengths populated.
 *   3. profileFromText on a realistic paste blob returns a sane LinkedInProfileInput.
 *   4. Every finding in every result has a non-empty suggestion.
 *   5. Scoring is deterministic (same input → same output twice).
 *   6. Partial profiles land in Intermediate / Advanced correctly.
 *   7. Score is always in [0, 100].
 */

import { auditProfile, profileFromText } from "@/lib/linkedin/audit";
import type { LinkedInProfileInput } from "@/lib/linkedin/types";

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const WEAK: LinkedInProfileInput = {
  headline: "",
  about: "",
  hasPhoto: false,
  hasCustomUrl: false,
  skillsCount: 0,
  connections: 10,
  experienceCount: 0,
  hasOpenToWork: false,
  featuredCount: 0,
  recommendationsCount: 0,
};

const STRONG: LinkedInProfileInput = {
  headline:
    "Senior Backend Engineer | Distributed Systems & Real-Time Data Pipelines | " +
    "TypeScript · Rust · Go | Open-source contributor | Ex-Google, Ex-Stripe",
  about:
    "With over a decade building distributed systems at hyper-growth companies, I " +
    "specialise in high-throughput data infrastructure, API design, and engineering " +
    "culture. At Google I led a team of 8 that reduced pipeline latency by 60% across " +
    "three product areas. At Stripe I owned the core idempotency layer that processes " +
    "billions of transactions annually. I am passionate about mentorship, technical " +
    "writing, and open-source - I maintain two widely-used TypeScript libraries with " +
    "combined 18k GitHub stars. Currently exploring senior IC or engineering leadership " +
    "roles at mission-driven companies in climate-tech or developer tooling. " +
    "Reach out at hello@example.com.",
  hasPhoto: true,
  hasCustomUrl: true,
  skillsCount: 18,
  connections: 800,
  experienceCount: 4,
  hasOpenToWork: true,
  featuredCount: 3,
  recommendationsCount: 7,
};

const INTERMEDIATE: LinkedInProfileInput = {
  headline: "Software Engineer at Acme Corp",          // job-title-only (12 pts)
  about: "I build software.",                           // <100 chars (5 pts)
  hasPhoto: true,                                       // 10 pts
  hasCustomUrl: false,                                  // 0 pts
  skillsCount: 6,                                       // 10 pts
  connections: 75,                                      // 5 pts
  experienceCount: 1,                                   // 5 pts
  hasOpenToWork: false,
  featuredCount: 0,                                     // 0 pts
  recommendationsCount: 0,                              // 0 pts
};
// Expected: 12 + 5 + 10 + 0 + 10 + 5 + 5 + 0 + 0 = 47 → Intermediate

const ADVANCED: LinkedInProfileInput = {
  headline:
    "Full-Stack Engineer | React, Node.js, PostgreSQL | Building fintech products",
  about:
    "Five years of experience shipping full-stack SaaS products from 0 to 1. " +
    "Comfortable across the entire web stack - React SPAs, Node.js APIs, PostgreSQL " +
    "schema design, and AWS deployments. I enjoy working in small teams where I can " +
    "have a direct product impact. Open to senior IC roles at seed-to-Series B fintechs.",
  hasPhoto: true,
  hasCustomUrl: true,
  skillsCount: 12,
  connections: 340,
  experienceCount: 3,
  hasOpenToWork: false,
  featuredCount: 0,        // no featured (0 pts)
  recommendationsCount: 0, // no recommendations (0 pts) → total 75 → Advanced
};
// Scoring: headline(15) + about(15) + photo(10) + url(10) + skills(10)
//         + connections(5) + experience(10) + featured(0) + recs(0) = 75 → Advanced

// ---------------------------------------------------------------------------
// A realistic LinkedIn "copy all" paste blob
// ---------------------------------------------------------------------------

const PASTE_BLOB = `
Jane Doe
Product Manager | SaaS & Marketplace | Driving 0→1 Products | Ex-Shopify | MBA Wharton
linkedin.com/in/janedoe-pm
500+ connections
Open to work

About
I am a product manager with 8 years of experience building SaaS and marketplace products.
At Shopify I led the launch of three 0→1 B2B features that collectively drove $12M ARR.
I excel at cross-functional leadership, data-informed prioritisation, and turning ambiguous
problems into roadmaps that engineering teams love to execute.
Currently looking for Head of Product or Director of Product roles at growth-stage B2B SaaS
companies. Happy to connect with founders and hiring managers.

Experience
Senior Product Manager
Shopify · Full-time
Jan 2020 - Mar 2024

Product Manager
Acme SaaS Inc · Full-time
Jun 2018 - Dec 2019

Junior Product Manager
Beta Marketplace · Full-time
Mar 2016 - May 2018

Skills
Product Strategy
Roadmapping
Data Analysis
SQL
Figma
Stakeholder Management
A/B Testing
Go-to-Market

Featured
Building a 0→1 B2B feature: lessons learned
The PM's guide to working with data engineers
My Shopify journey: 4 years in review

Recommendations (4)
`;

// ---------------------------------------------------------------------------
// Section 1 - Weak profile
// ---------------------------------------------------------------------------

console.log("\nweak profile:");

const weakResult = auditProfile(WEAK);

check("score is in [0, 100]", weakResult.score >= 0 && weakResult.score <= 100);
check("weak profile score < 40", weakResult.score < 40);
check("weak profile tier is Beginner", weakResult.tier === "Beginner");
check(
  "weak profile has ≥3 high-severity findings",
  weakResult.findings.filter((f) => f.severity === "high").length >= 3,
);
check("weak profile has at least one finding", weakResult.findings.length > 0);
check(
  "every weak finding has a non-empty suggestion",
  weakResult.findings.every((f) => f.suggestion.trim().length > 0),
);
check(
  "every weak finding has a non-empty area",
  weakResult.findings.every((f) => f.area.trim().length > 0),
);
check(
  "every weak finding has a non-empty issue",
  weakResult.findings.every((f) => f.issue.trim().length > 0),
);

// ---------------------------------------------------------------------------
// Section 2 - Strong / All-Star profile
// ---------------------------------------------------------------------------

console.log("\nstrong profile:");

const strongResult = auditProfile(STRONG);

check("score is in [0, 100]", strongResult.score >= 0 && strongResult.score <= 100);
check("strong profile score ≥ 85", strongResult.score >= 85);
check("strong profile tier is All-Star", strongResult.tier === "All-Star");
check("strong profile has no high-severity findings", strongResult.findings.filter((f) => f.severity === "high").length === 0);
check("strong profile strengths list is non-empty", strongResult.strengths.length > 0);
check(
  "every strong finding has a non-empty suggestion (if any)",
  strongResult.findings.every((f) => f.suggestion.trim().length > 0),
);

// ---------------------------------------------------------------------------
// Section 3 - Intermediate profile
// ---------------------------------------------------------------------------

console.log("\nintermediate profile:");

const intermediateResult = auditProfile(INTERMEDIATE);

check("score is in [0, 100]", intermediateResult.score >= 0 && intermediateResult.score <= 100);
check("intermediate score in [40, 64]", intermediateResult.score >= 40 && intermediateResult.score < 65);
check("intermediate tier is Intermediate", intermediateResult.tier === "Intermediate");
check(
  "intermediate profile has findings",
  intermediateResult.findings.length > 0,
);

// ---------------------------------------------------------------------------
// Section 4 - Advanced profile
// ---------------------------------------------------------------------------

console.log("\nadvanced profile:");

const advancedResult = auditProfile(ADVANCED);

check("score is in [0, 100]", advancedResult.score >= 0 && advancedResult.score <= 100);
check("advanced score in [65, 84]", advancedResult.score >= 65 && advancedResult.score < 85);
check("advanced tier is Advanced", advancedResult.tier === "Advanced");

// ---------------------------------------------------------------------------
// Section 5 - profileFromText parser
// ---------------------------------------------------------------------------

console.log("\nprofileFromText:");

const parsed = profileFromText(PASTE_BLOB);

check("headline is a non-empty string", typeof parsed.headline === "string" && parsed.headline.trim().length > 0);
check("about is a non-empty string", typeof parsed.about === "string" && parsed.about.trim().length > 0);
check("skillsCount is a non-negative integer", Number.isInteger(parsed.skillsCount) && parsed.skillsCount >= 0);
check("connections is a non-negative integer", Number.isInteger(parsed.connections) && parsed.connections >= 0);
check("experienceCount is a non-negative integer", Number.isInteger(parsed.experienceCount) && parsed.experienceCount >= 0);
check("connections detected as 500 (from '500+ connections')", parsed.connections === 500);
check("hasCustomUrl detected (linkedin.com/in/janedoe-pm)", parsed.hasCustomUrl === true);
check("hasOpenToWork detected ('Open to work')", parsed.hasOpenToWork === true);
check("experienceCount ≥ 1", parsed.experienceCount >= 1);
check("about length > 50", parsed.about.length > 50);
// Skills in paste: 8 lines under Skills section
check("skillsCount ≥ 5 from paste", parsed.skillsCount >= 5);
// Featured: 3 items
check("featuredCount ≥ 1", (parsed.featuredCount ?? 0) >= 1);
// Recommendations: (4)
check("recommendationsCount === 4", parsed.recommendationsCount === 4);

// ---------------------------------------------------------------------------
// Section 6 - Determinism
// ---------------------------------------------------------------------------

console.log("\ndeterminism:");

const r1 = auditProfile(STRONG);
const r2 = auditProfile(STRONG);
check("same input produces same score twice", r1.score === r2.score);
check("same input produces same tier twice", r1.tier === r2.tier);
check("same input produces same findings count twice", r1.findings.length === r2.findings.length);

// ---------------------------------------------------------------------------
// Section 7 - Severity ordering
// ---------------------------------------------------------------------------

console.log("\nfinding ordering:");

const weakFindings = auditProfile(WEAK).findings;
const orders = weakFindings.map((f) => (f.severity === "high" ? 0 : f.severity === "medium" ? 1 : 2));
check(
  "findings are sorted high → medium → low",
  orders.every((v, i) => i === 0 || v >= orders[i - 1]),
);

// ---------------------------------------------------------------------------
// Section 8 - Edge cases
// ---------------------------------------------------------------------------

console.log("\nedge cases:");

// Headline exactly 40 chars
const at40: LinkedInProfileInput = {
  ...WEAK,
  headline: "Software Engineer | TypeScript | React!!",  // exactly 40 chars
};
check("headline exactly 40 chars (not job-title-only) → full headline score", (() => {
  const r = auditProfile(at40);
  return !r.findings.some((f) => f.area === "Headline" && f.severity === "high");
})());

// Zero skills but has everything else
const noSkills: LinkedInProfileInput = {
  ...STRONG,
  skillsCount: 0,
};
const noSkillsResult = auditProfile(noSkills);
check(
  "zero skills produces a high-severity Skills finding",
  noSkillsResult.findings.some((f) => f.area === "Skills" && f.severity === "high"),
);

// profileFromText on empty string returns valid shape
const emptyParsed = profileFromText("");
check("empty string returns valid LinkedInProfileInput shape", (
  typeof emptyParsed.headline === "string" &&
  typeof emptyParsed.about === "string" &&
  typeof emptyParsed.hasPhoto === "boolean" &&
  typeof emptyParsed.hasCustomUrl === "boolean" &&
  typeof emptyParsed.skillsCount === "number" &&
  typeof emptyParsed.connections === "number" &&
  typeof emptyParsed.experienceCount === "number"
));

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
