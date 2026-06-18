/**
 * Phase 6 gate - Track + Gmail. Holistic proof over the deterministic corpus
 * (lib/track/fixtures.ts) that the classify -> .ics parse -> thread -> PROPOSE
 * pipeline is correct AND safe. Pure: no DB, no network, no LLM.
 *
 * The safety invariants this gate locks down (plan §8d, Hardening §F):
 *   - The 5 real-inbox newsletters/notifications classify as NOT_JOB (no bogus
 *     proposal is ever spawned from marketing that merely says "application").
 *   - A status move into INTERVIEWING / OFFER / REJECTED is ALWAYS
 *     requiresConfirm - the system proposes, the human commits.
 *   - NOT_JOB email never yields a proposal.
 *   - Calendar invites are read from the .ics MIME part (start time + cancel).
 *   - Re-sync is idempotent (dedupe by message id).
 *
 * Run: npm run test:track
 */

import { classifyEmail } from "@/lib/track/classify";
import { parseIcs } from "@/lib/track/ics";
import { proposeStatusChange } from "@/lib/track/proposals";
import { matchEmailToApp } from "@/lib/track/threading";
import { buildBoard } from "@/lib/track/board";
import { planSync, nextSyncState, dedupeNewEmails } from "@/lib/track/sync";
import { processEmails, previewTrack } from "@/lib/track/pipeline";
import {
  fixtureEmails,
  fixtureRawEmails,
  fixtureApps,
} from "@/lib/track/fixtures";
import {
  NEVER_AUTO_STATUSES,
  type AppStatus,
  type ClassificationResult,
  type EmailCategory,
  type RawEmail,
} from "@/lib/track/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra?: string): void {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${name}${extra ? ` - ${extra}` : ""}`);
  }
}

const byId = (id: string): RawEmail => {
  const e = fixtureRawEmails.find((x) => x.gmailMessageId === id);
  if (!e) throw new Error(`fixture email not found: ${id}`);
  return e;
};

const cls = (category: EmailCategory): ClassificationResult => ({
  category,
  confidence: 0.9,
  reasons: ["test"],
  isJobRelated: category !== "NOT_JOB",
});

// -- 1. Classification: every fixture matches its ground-truth category -------
for (const f of fixtureEmails) {
  const got = classifyEmail(f.email);
  check(
    `classify "${f.email.subject.slice(0, 42)}" -> ${f.expectedCategory}`,
    got.category === f.expectedCategory,
    `got ${got.category} (${f.note})`,
  );
}

// The 5 real-inbox negatives must be NOT_JOB (the headline correctness risk).
for (const id of [
  "neg-github-1",
  "neg-aistudio-1",
  "neg-openrouter-1",
  "neg-gemini-career-1",
  "neg-perplexity-1",
]) {
  check(`negative ${id} -> NOT_JOB`, classifyEmail(byId(id)).category === "NOT_JOB");
}

// -- 2. .ics parsing from the MIME part ---------------------------------------
const req = parseIcs(byId("pos-stripe-invite-1").icsRaw!);
check("ics REQUEST start", req?.start === "2026-06-22T16:00:00.000Z", req?.start);
check("ics REQUEST not cancelled", req?.cancelled === false);
check("ics REQUEST method", req?.method === "REQUEST");
check("ics REQUEST allDay false", req?.allDay === false);
check("ics REQUEST summary", Boolean(req?.summary));

const cancel = parseIcs(byId("pos-stripe-cancel-1").icsRaw!);
check("ics CANCEL cancelled", cancel?.cancelled === true);
check("ics CANCEL method", cancel?.method === "CANCEL");

const allday = parseIcs(byId("pos-datadog-onsite-1").icsRaw!);
check("ics all-day flagged", allday?.allDay === true);
check("ics all-day date", allday?.start === "2026-07-01", allday?.start);

// -- 3. Proposals: the mapping + guards ---------------------------------------
const pInterview = proposeStatusChange(cls("INTERVIEW_INVITE"), "APPLIED");
check("invite@APPLIED -> INTERVIEWING", pInterview?.toStatus === "INTERVIEWING");
check("invite@APPLIED requiresConfirm", pInterview?.requiresConfirm === true);
check(
  "invite@INTERVIEWING -> null (no-op)",
  proposeStatusChange(cls("INTERVIEW_INVITE"), "INTERVIEWING") === null,
);
const pOffer = proposeStatusChange(cls("OFFER"), "INTERVIEWING");
check("offer -> OFFER requiresConfirm", pOffer?.toStatus === "OFFER" && pOffer?.requiresConfirm === true);
const pSoft = proposeStatusChange(cls("SOFT_REJECTION"), "APPLIED");
check("soft -> REJECTED soft=true", pSoft?.toStatus === "REJECTED" && pSoft?.soft === true);
check("soft requiresConfirm", pSoft?.requiresConfirm === true);
const pRej = proposeStatusChange(cls("REJECTION"), "APPLIED");
check("rejection -> REJECTED soft=false", pRej?.toStatus === "REJECTED" && pRej?.soft === false);
const pRecv = proposeStatusChange(cls("APPLICATION_RECEIVED"), "TO_APPLY");
check("received@TO_APPLY -> APPLIED", pRecv?.toStatus === "APPLIED");
check("received -> APPLIED requiresConfirm false", pRecv?.requiresConfirm === false);
check(
  "received@APPLIED -> null (no backward)",
  proposeStatusChange(cls("APPLICATION_RECEIVED"), "APPLIED") === null,
);
check("NOT_JOB -> null", proposeStatusChange(cls("NOT_JOB"), "APPLIED") === null);
check("recruiter -> null", proposeStatusChange(cls("RECRUITER_OUTREACH"), undefined) === null);
const pUnmatched = proposeStatusChange(cls("INTERVIEW_INVITE"), undefined);
check("invite@unmatched -> INTERVIEWING, no from", pUnmatched?.toStatus === "INTERVIEWING" && pUnmatched?.fromStatus === undefined);

// -- 4. Safety invariant: NEVER auto-apply Interviewing/Offer/Rejected -------
const processed = processEmails(fixtureRawEmails, fixtureApps);
for (const p of processed) {
  if (p.proposal && NEVER_AUTO_STATUSES.has(p.proposal.toStatus)) {
    check(
      `confirm-gate on ${p.proposal.toStatus} (${p.email.gmailMessageId})`,
      p.proposal.requiresConfirm === true,
    );
  }
  // NOT_JOB email must never produce a proposal.
  if (p.classification.category === "NOT_JOB") {
    check(`NOT_JOB ${p.email.gmailMessageId} has no proposal`, p.proposal === null);
  }
}

// -- 5. Threading -------------------------------------------------------------
check(
  "thread: stripe invite -> app-stripe",
  matchEmailToApp(byId("pos-stripe-invite-1"), fixtureApps).applicationId === "app-stripe",
);
check(
  "thread: datadog received -> app-datadog",
  matchEmailToApp(byId("pos-datadog-received-1"), fixtureApps).applicationId === "app-datadog",
);
check(
  "thread: github negative -> none",
  matchEmailToApp(byId("neg-github-1"), fixtureApps).matchedBy === "none",
);

// -- 6. Board grouping --------------------------------------------------------
const board = buildBoard(fixtureApps);
const col = (s: AppStatus) => board.find((c) => c.status === s)?.apps.length ?? -1;
check("board has 6 columns", board.length === 6);
check("board WARM_PATH 1", col("WARM_PATH") === 1);
check("board TO_APPLY 1", col("TO_APPLY") === 1);
check("board APPLIED 4", col("APPLIED") === 4, String(col("APPLIED")));
check("board INTERVIEWING 2", col("INTERVIEWING") === 2);

// -- 7. Sync watermark + idempotent dedupe ------------------------------------
check("planSync full", planSync({}).mode === "full");
const inc = planSync({ historyId: "100" });
check("planSync incremental", inc.mode === "incremental" && inc.sinceHistoryId === "100");
check(
  "nextSyncState keeps larger historyId",
  nextSyncState({ historyId: "100" }, "90", "2026-06-16T00:00:00.000Z").historyId === "100",
);
check(
  "dedupe drops one seen id",
  dedupeNewEmails(["neg-github-1"], fixtureRawEmails).length === fixtureRawEmails.length - 1,
);
check(
  "dedupe all-seen -> empty (idempotent re-sync)",
  dedupeNewEmails(
    fixtureRawEmails.map((e) => e.gmailMessageId),
    fixtureRawEmails,
  ).length === 0,
);

// -- 8. previewTrack (the offline /track render) ------------------------------
const preview = previewTrack();
check("preview board 6 columns", preview.board.length === 6);
check("preview proposals all job-related", preview.proposals.length > 0);
check(
  "preview proposals exclude NOT_JOB",
  preview.proposals.every((p) => p.category !== "NOT_JOB"),
);

// -- Summary ------------------------------------------------------------------
console.log(`\ntrack ${passed}/${passed + failed}`);
if (failed > 0) {
  console.error(`FAILED: ${failed} assertion(s)`);
  process.exit(1);
}
