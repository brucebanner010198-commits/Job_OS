/**
 * Self-test for the EXTRACTIVE warm-intro DRAFT brain (Phase 7, plan §9 + §B/§F).
 * Pure, offline, deterministic. No LLM, no DB, no network, no wall clock.
 *
 * Proves the safety spine of lib/warm/draft.ts:
 *   - a real path drafts a specific, polite, grounded ask (name + real tie +
 *     company + role + signature) and records a verbatim provenance trail;
 *   - the PROVENANCE INVARIANT holds: every usedFacts entry is a substring of
 *     the concatenation of all input fields (nothing is fabricated);
 *   - an ADVERSARIAL connection with NO howKnown / sharedContext never asserts
 *     "we worked together" or a shared employer - generic-but-true only;
 *   - a NONE path refuses to draft (empty body, provenanceOk=false, violation).
 *
 * Run: npx tsx scripts/test-warm-draft.ts
 */
import { draftIntroRequest } from "@/lib/warm/draft";
import { bestWarmPath } from "@/lib/warm/rank";
import {
  fixtureConnections,
  fixtureRequester,
  fixtureTargets,
} from "@/lib/warm/fixtures";
import type {
  Connection,
  RequesterProfile,
  WarmPath,
  WarmTarget,
} from "@/lib/warm/types";

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

/** Words = whitespace tokens that contain at least one alphanumeric char. */
function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
}

/** Last non-empty line - the signature. */
function signature(body: string): string {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines[lines.length - 1] ?? "";
}

/**
 * The concatenation of all input fields the draft is allowed to quote. The
 * provenance invariant: every usedFacts entry must be a substring of this.
 */
function joinedInputs(path: WarmPath, requester: RequesterProfile): string {
  const c = path.connection;
  const t = path.target;
  const fields: (string | undefined)[] = [
    c?.fullName,
    c?.headline,
    c?.company,
    c?.companyDomain,
    c?.title,
    c?.howKnown,
    c?.sharedContext,
    c?.profileUrl,
    t.company,
    t.companyDomain,
    t.jobTitle,
    requester.fullName,
    requester.headline,
    requester.pitch,
  ];
  return fields.filter((x): x is string => typeof x === "string").join(" | ");
}

/** True iff every recorded fact is a verbatim slice of the inputs. */
function provenanceHolds(
  usedFacts: string[],
  path: WarmPath,
  requester: RequesterProfile,
): boolean {
  const haystack = joinedInputs(path, requester);
  return usedFacts.every((f) => haystack.includes(f));
}

const notionTarget = fixtureTargets.find((t) => t.company === "Notion")!;
const datadogTarget = fixtureTargets.find((t) => t.company === "Datadog")!;

// --- 1. Real path: Notion via Priya (COLLEAGUE, worked together at Acme) -----

console.log("\nwarm-draft - Notion / Priya extractive ask:");

const notionPath = bestWarmPath(notionTarget, fixtureConnections);
check(
  "bestWarmPath(Notion) → a real path through Priya",
  notionPath.pathKind !== "NONE" &&
    notionPath.connection?.fullName === "Priya Sharma",
);

const notionDraft = draftIntroRequest(notionPath, fixtureRequester);

check("body addresses Priya by name", notionDraft.body.includes("Priya"));
check(
  "body references the REAL tie (Acme / payments)",
  notionDraft.body.includes("Acme") || notionDraft.body.includes("payments"),
);
check("body mentions the target company Notion", notionDraft.body.includes("Notion"));
check(
  "body mentions the role (Software Engineer)",
  notionDraft.body.includes("Software Engineer"),
);
check(
  "signed with the requester's real name, ending in \"Bruce\"",
  signature(notionDraft.body) === fixtureRequester.fullName &&
    signature(notionDraft.body).includes("Bruce"),
);
check("provenanceOk is true", notionDraft.provenanceOk === true);
check("no violations on a grounded draft", notionDraft.violations.length === 0);
check("usedFacts is non-empty", notionDraft.usedFacts.length > 0);
check(
  "PROVENANCE INVARIANT: every usedFacts entry ⊂ joined inputs",
  provenanceHolds(notionDraft.usedFacts, notionPath, fixtureRequester),
);
check("body is short (< 120 words)", wordCount(notionDraft.body) < 120);
// Priya has a profileUrl, so the ranker chose LinkedIn → no subject.
check(
  "linkedin channel → subject is undefined",
  notionDraft.channel !== "linkedin" || notionDraft.subject === undefined,
);

// --- 2. Email channel → a short 2–4 word subject -----------------------------

console.log("\nwarm-draft - email subject line:");

const emailPath: WarmPath = { ...notionPath, channel: "email" };
const emailDraft = draftIntroRequest(emailPath, fixtureRequester);
check("email channel yields a defined subject", typeof emailDraft.subject === "string");
check(
  "subject names the company (Notion)",
  !!emailDraft.subject && emailDraft.subject.includes("Notion"),
);
check(
  "subject is 2–4 words",
  !!emailDraft.subject &&
    wordCount(emailDraft.subject) >= 2 &&
    wordCount(emailDraft.subject) <= 4,
);
check(
  "email body is still grounded (provenanceOk true)",
  emailDraft.provenanceOk === true &&
    provenanceHolds(emailDraft.usedFacts, emailPath, fixtureRequester),
);

// --- 3. ADVERSARIAL: COMMUNITY tie, no howKnown / sharedContext --------------
// Hand-built so the draft is FORCED into the no-grounding branch. It must never
// invent "we worked together" or a shared employer just because the connection
// and the target share the company name "Acme".

console.log("\nwarm-draft - adversarial (no grounding facts):");

const adversarialConn: Connection = {
  fullName: "Casey Morgan",
  headline: "Software Engineer at Acme",
  company: "Acme",
  companyDomain: "acme.com",
  title: "Software Engineer",
  relationship: "COMMUNITY",
  degree: 2,
  // NO howKnown, NO sharedContext - the whole point of the test.
  source: "fixture",
};
const adversarialTarget: WarmTarget = {
  company: "Acme",
  companyDomain: "acme.com",
  jobTitle: "Software Engineer",
};
const adversarialPath: WarmPath = {
  target: adversarialTarget,
  connection: adversarialConn,
  pathKind: "COMMUNITY",
  strength: 0.5,
  reasons: ["Casey Morgan is a 2nd-degree community contact at Acme."],
  reachOut: true,
  gateReason: "Community path through Casey Morgan - worth a brief, genuine ask.",
  channel: "linkedin",
};
// Minimal requester so nothing else introduces the word "Acme" by accident.
const minimalRequester: RequesterProfile = { fullName: "Bruce Banner" };
const advDraft = draftIntroRequest(adversarialPath, minimalRequester);

const advLower = advDraft.body.toLowerCase();
check(
  "body does NOT claim \"worked together\"",
  !advLower.includes("worked together"),
);
check(
  "body does NOT fabricate a shared employer/team (\"we worked\" / \"we both\")",
  !advLower.includes("we worked") && !advLower.includes("we both"),
);
check("adversarial draft is still provenanceOk true", advDraft.provenanceOk === true);
check("adversarial draft has no violations", advDraft.violations.length === 0);
check("adversarial usedFacts is non-empty", advDraft.usedFacts.length > 0);
check(
  "no fabricated fact: every usedFacts entry ⊂ joined inputs",
  provenanceHolds(advDraft.usedFacts, adversarialPath, minimalRequester),
);
check(
  "adversarial body still addresses Casey by first name",
  advDraft.body.includes("Casey"),
);

// --- 4. NONE path: refuse to draft, recommend applying cold ------------------

console.log("\nwarm-draft - NONE path refuses to draft:");

const nonePath = bestWarmPath(datadogTarget, fixtureConnections);
check("bestWarmPath(Datadog) → NONE", nonePath.pathKind === "NONE");

const noneDraft = draftIntroRequest(nonePath, fixtureRequester);
check("NONE draft body is empty", noneDraft.body === "");
check("NONE draft provenanceOk is false", noneDraft.provenanceOk === false);
check("NONE draft usedFacts is empty", noneDraft.usedFacts.length === 0);
check("NONE draft violations is non-empty", noneDraft.violations.length > 0);
check("NONE draft has no subject", noneDraft.subject === undefined);

// --- Summary -----------------------------------------------------------------

console.log(`\nwarm-draft ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
