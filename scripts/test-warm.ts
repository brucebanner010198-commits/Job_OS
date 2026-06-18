/**
 * Phase 7 warm-path INTEGRATION gate (the integrator-owned cross-module test).
 * Pure: no LLM/DB/network. Proves the full spine end-to-end -
 *   rank (paths-in) -> reach-out etiquette gate -> EXTRACTIVE draft (provenance)
 *   -> pipeline view models -> offline preview.
 *
 * The two invariants that matter most:
 *   (1) ETIQUETTE: a NONE path never says "reach out"; the gate recommends
 *       applying cold instead of manufacturing a tie. At most one ask/company.
 *   (2) PROVENANCE: every fact a draft quotes traces back to a real input; a
 *       draft that can't be grounded is flagged (provenanceOk=false), never sent.
 *
 * Run: npm run test:warm
 */

import { rankWarmPaths, bestWarmPath } from "@/lib/warm/rank";
import { draftIntroRequest } from "@/lib/warm/draft";
import { processWarmTargets, previewWarm } from "@/lib/warm/pipeline";
import {
  fixtureConnections,
  fixtureTargets,
  fixtureRequester,
} from "@/lib/warm/fixtures";
import {
  MAX_ASKS_PER_COMPANY,
  MIN_STRENGTH_TO_REACH_OUT,
  type Connection,
  type WarmPath,
  type WarmTarget,
} from "@/lib/warm/types";

let pass = 0;
let fail = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error("  ✗ " + msg);
  }
}

function target(company: string): WarmTarget {
  const t = fixtureTargets.find((x) => x.company === company);
  if (!t) throw new Error("fixture target missing: " + company);
  return t;
}

// --- 1. Ranking + strongest-first ------------------------------------------
const notion = bestWarmPath(target("Notion"), fixtureConnections);
ok(notion.pathKind === "CURRENT_COLLEAGUE", "Notion best path is CURRENT_COLLEAGUE");
ok(notion.connection?.fullName === "Priya Sharma", "Notion best path is Priya Sharma");
ok(notion.strength >= 0.9, "Notion path strength is high (>=0.9)");
ok(notion.reachOut === true, "Notion path passes the reach-out gate");

const notionAll = rankWarmPaths(target("Notion"), fixtureConnections);
const priyaIdx = notionAll.findIndex((p) => p.connection?.fullName === "Priya Sharma");
const marcusIdx = notionAll.findIndex((p) => p.connection?.fullName === "Marcus Webb");
ok(priyaIdx === 0, "Notion ranking is strongest-first (Priya at index 0)");
ok(marcusIdx > priyaIdx, "the weaker community tie ranks below the colleague");

const linear = bestWarmPath(target("Linear"), fixtureConnections);
ok(linear.pathKind === "ALUMNI", "Linear best path is ALUMNI (Alex Chen)");
ok(linear.connection?.fullName === "Alex Chen", "Linear path runs through Alex Chen");
ok(linear.reachOut === true, "Linear alumni path clears the reach-out threshold");
ok(linear.strength >= MIN_STRENGTH_TO_REACH_OUT, "Linear strength >= MIN_STRENGTH_TO_REACH_OUT");

// --- 2. The etiquette gate (NONE -> apply cold) ----------------------------
const datadog = bestWarmPath(target("Datadog"), fixtureConnections);
ok(datadog.pathKind === "NONE", "Datadog (no connection) yields a NONE path");
ok(datadog.strength === 0, "NONE path has strength 0");
ok(datadog.reachOut === false, "NONE path does NOT recommend reaching out");
ok(datadog.connection === undefined, "NONE path carries no connection");
ok(/appl/i.test(datadog.gateReason), "NONE gateReason recommends applying directly");
ok(MAX_ASKS_PER_COMPANY === 1, "etiquette cap is one ask per company");

// every path has non-empty reasons + gateReason
for (const t of fixtureTargets) {
  const p = bestWarmPath(t, fixtureConnections);
  ok(p.reasons.length > 0, `path for ${t.company} has reasons`);
  ok(p.gateReason.length > 0, `path for ${t.company} has a gateReason`);
  ok(p.strength >= 0 && p.strength <= 1, `path for ${t.company} strength in [0,1]`);
}

// --- 3. Draft provenance (EXTRACTIVE) --------------------------------------
function joinedInputs(path: WarmPath): string {
  const c = path.connection;
  return [
    c?.fullName,
    c?.headline,
    c?.company,
    c?.title,
    c?.howKnown,
    c?.sharedContext,
    path.target.company,
    path.target.jobTitle,
    fixtureRequester.fullName,
    fixtureRequester.headline,
    fixtureRequester.pitch,
  ]
    .filter(Boolean)
    .join(" | ");
}

const notionDraft = draftIntroRequest(notion, fixtureRequester);
ok(notionDraft.provenanceOk === true, "Notion draft is provenance-clean");
ok(/Priya/.test(notionDraft.body), "Notion draft addresses Priya by name");
ok(
  /Acme|payments/i.test(notionDraft.body),
  "Notion draft references the real tie (Acme / payments)",
);
ok(/Notion/.test(notionDraft.body), "Notion draft names the target company");
ok(/Bruce/.test(notionDraft.body), "Notion draft is signed by the requester");
ok(notionDraft.usedFacts.length > 0, "Notion draft records the facts it used");
{
  const inputs = joinedInputs(notion);
  const allTraced = notionDraft.usedFacts.every((f) => inputs.includes(f));
  ok(allTraced, "every usedFacts entry traces to a real input (provenance invariant)");
}

// Adversarial: a connection with NO grounding facts must not be fabricated into one.
const baldConnection: Connection = {
  fullName: "Dana Stone",
  company: "Acme",
  companyDomain: "acme.test",
  relationship: "COMMUNITY",
  degree: 2,
  source: "manual",
};
const baldTarget: WarmTarget = { company: "Acme", companyDomain: "acme.test" };
const baldPath = bestWarmPath(baldTarget, [baldConnection]);
const baldDraft = draftIntroRequest(baldPath, fixtureRequester);
ok(baldPath.pathKind !== "NONE", "a bald community tie is still a (weak) path");
ok(
  !/worked together/i.test(baldDraft.body),
  "draft does NOT fabricate 'worked together' when no shared history exists",
);
ok(baldDraft.provenanceOk === true, "ungrounded-but-truthful draft is still provenance-clean");
{
  const inputs = joinedInputs(baldPath);
  ok(
    baldDraft.usedFacts.every((f) => inputs.includes(f)),
    "adversarial draft invents no facts",
  );
}

// NONE path -> blocked draft
const noneDraft = draftIntroRequest(datadog, fixtureRequester);
ok(noneDraft.provenanceOk === false, "NONE-path draft is flagged not-sendable");
ok(noneDraft.body === "", "NONE-path draft has an empty body");
ok(noneDraft.violations.length > 0, "NONE-path draft explains why it is blocked");

// --- 4. Pipeline + offline preview -----------------------------------------
const views = processWarmTargets(
  fixtureTargets,
  fixtureConnections,
  fixtureRequester,
);
ok(views.length === fixtureTargets.length, "one view per target");
const notionView = views.find((v) => v.company === "Notion");
const datadogView = views.find((v) => v.company === "Datadog");
ok(!!notionView?.draftBody, "Notion view carries a drafted ask");
ok(notionView?.reachOut === true, "Notion view recommends reaching out");
ok(!datadogView?.draftBody, "Datadog view has no draft (apply cold)");
ok(datadogView?.reachOut === false, "Datadog view does not recommend reaching out");

// no drafted view is ever provenance-broken
for (const v of views) {
  if (v.draftBody) {
    ok(v.provenanceOk !== false, `drafted view for ${v.company} is provenance-clean`);
  }
}

const preview = previewWarm();
ok(preview.paths.length === fixtureTargets.length, "previewWarm covers every target");
ok(
  preview.paths.some((p) => p.reachOut) && preview.paths.some((p) => !p.reachOut),
  "preview shows both a warm path and an apply-cold case",
);

// --- report ----------------------------------------------------------------
const total = pass + fail;
if (fail > 0) {
  console.error(`\nwarm ${pass}/${total} - FAILED (${fail})`);
  process.exit(1);
}
console.log(`warm ${pass}/${total}`);
