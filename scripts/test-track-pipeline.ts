/**
 * Self-test for the composed Track pipeline (Phase 6, plan §8d).
 * Pure, offline, deterministic - no LLM, no DB, no network.
 *
 * Exercises lib/track/pipeline.ts only (the brains + DB-free glue):
 *   1. processEmails reproduces every fixtureEmails[i].expectedCategory.
 *   2. The safety spine holds: NOT_JOB and RECRUITER_OUTREACH never propose;
 *      an already-at-target email (Datadog receipt onto an APPLIED app) is a
 *      no-op; every move into INTERVIEWING/OFFER/REJECTED requiresConfirm.
 *   3. previewTrack projects the fixture board (6 columns, right titles, 8 apps)
 *      and the pending proposals (company filled, event fields flow through).
 * Run: npx tsx scripts/test-track-pipeline.ts
 */
import { processEmails, previewTrack } from "@/lib/track/pipeline";
import { fixtureApps, fixtureEmails, fixtureRawEmails } from "@/lib/track/fixtures";
import { COLUMN_TITLES } from "@/lib/track/board";
import { BOARD_COLUMNS } from "@/lib/track/types";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` - ${detail}` : ""}`);
  }
}

// --- 1. classification reproduced through the pipeline ----------------------
console.log("classify (via processEmails):");
{
  const processed = processEmails(
    fixtureEmails.map((f) => f.email),
    fixtureApps,
  );
  fixtureEmails.forEach((f, i) => {
    const got = processed[i].classification.category;
    check(
      `${f.email.gmailMessageId} → ${got}`,
      got === f.expectedCategory,
      `expected ${f.expectedCategory}`,
    );
  });
}

// --- 2. safety spine in the proposal layer ----------------------------------
console.log("\nsafety spine:");
{
  const byId = new Map(
    processEmails(fixtureRawEmails, fixtureApps).map((p) => [
      p.email.gmailMessageId,
      p,
    ]),
  );

  // NOT_JOB never proposes.
  const negatives = [
    "neg-github-1",
    "neg-aistudio-1",
    "neg-openrouter-1",
    "neg-gemini-career-1",
    "neg-perplexity-1",
  ];
  check(
    "every NOT_JOB email yields a null proposal",
    negatives.every((id) => byId.get(id)?.proposal === null),
  );

  // Recruiter outreach is a lead, not a status change.
  check(
    "recruiter outreach yields a null proposal",
    byId.get("pos-meta-outreach-1")?.proposal === null,
  );

  // Already-at-target (receipt onto an APPLIED app) is a no-op.
  check(
    "application-receipt onto APPLIED app is a no-op",
    byId.get("pos-datadog-received-1")?.proposal === null,
  );

  // Offer/interview/assessment/rejection moves are all confirm-gated.
  const gated = [
    "pos-stripe-invite-1",
    "pos-datadog-onsite-1",
    "pos-vercel-offer-1",
    "pos-airbnb-reject-1",
    "pos-figma-soft-1",
    "pos-coinbase-assess-1",
  ];
  check(
    "every INTERVIEWING/OFFER/REJECTED proposal requiresConfirm",
    gated.every((id) => byId.get(id)?.proposal?.requiresConfirm === true),
  );

  // The soft rejection is flagged soft; the offer targets OFFER.
  check("soft rejection flagged soft", byId.get("pos-figma-soft-1")?.proposal?.soft === true);
  check("offer targets OFFER", byId.get("pos-vercel-offer-1")?.proposal?.toStatus === "OFFER");
  check(
    "cancel invite still parses a cancelled event",
    byId.get("pos-stripe-cancel-1")?.event?.cancelled === true,
  );
}

// --- 3. previewTrack projection ---------------------------------------------
console.log("\npreviewTrack:");
{
  const { board, proposals } = previewTrack();

  check("board has one column per BOARD_COLUMNS", board.length === BOARD_COLUMNS.length);
  check(
    "columns are in BOARD_COLUMNS order with COLUMN_TITLES",
    board.every((c, i) => c.status === BOARD_COLUMNS[i] && c.title === COLUMN_TITLES[c.status]),
  );

  const totalApps = board.reduce((n, c) => n + c.apps.length, 0);
  check("board holds all 8 fixture apps", totalApps === fixtureApps.length, `got ${totalApps}`);
  check(
    "every board app has route:null in the preview",
    board.every((c) => c.apps.every((a) => a.route === null)),
  );

  // 7 fixture emails warrant a confirmable proposal (see test-track-proposals).
  check("previewTrack surfaces 7 proposals", proposals.length === 7, `got ${proposals.length}`);
  check(
    "every preview proposal has a company filled from its app",
    proposals.every((p) => typeof p.company === "string" && p.company.length > 0),
  );
  check(
    "every preview proposal carries a toStatus + applicationId",
    proposals.every((p) => Boolean(p.toStatus) && Boolean(p.applicationId)),
  );

  const invite = proposals.find((p) => p.id === "pos-stripe-invite-1");
  check("stripe invite proposal has an eventStart", Boolean(invite?.eventStart), `eventStart=${invite?.eventStart}`);
  check("stripe invite proposal company is Stripe", invite?.company === "Stripe");
}

// --- summary ----------------------------------------------------------------
console.log(`\npipeline ${passed}/${passed + failed}`);
if (failed > 0) process.exit(1);
