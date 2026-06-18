/**
 * Self-test for the Track status PROPOSER (Phase 6, plan §8d).
 * Pure, offline, deterministic. No LLM, no DB, no network, no wall clock.
 * Run: npx tsx scripts/test-track-proposals.ts
 */
import { proposeStatusChange } from "@/lib/track/proposals";
import type {
  ClassificationResult,
  EmailCategory,
  StatusProposal,
} from "@/lib/track/types";

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

/** Build a minimal ClassificationResult for a category. */
function mk(category: EmailCategory): ClassificationResult {
  return {
    category,
    confidence: 0.9,
    reasons: ["x"],
    isJobRelated: category !== "NOT_JOB",
  };
}

console.log("\nproposals - targets, guards, and confirm gating:");

// 1. Interview invite onto an APPLIED app → INTERVIEWING, must confirm.
const p1 = proposeStatusChange(mk("INTERVIEW_INVITE"), "APPLIED");
check(
  "INTERVIEW_INVITE@APPLIED → INTERVIEWING, requiresConfirm true",
  p1 !== null && p1.toStatus === "INTERVIEWING" && p1.requiresConfirm === true,
);

// 2. Already interviewing → no-op.
check(
  "INTERVIEW_INVITE@INTERVIEWING → null (no-op)",
  proposeStatusChange(mk("INTERVIEW_INVITE"), "INTERVIEWING") === null,
);

// 3. Offer while interviewing → OFFER, must confirm.
const p3 = proposeStatusChange(mk("OFFER"), "INTERVIEWING");
check(
  "OFFER@INTERVIEWING → OFFER, requiresConfirm true",
  p3 !== null && p3.toStatus === "OFFER" && p3.requiresConfirm === true,
);

// 4. Soft rejection → REJECTED, soft true, must confirm.
const p4 = proposeStatusChange(mk("SOFT_REJECTION"), "APPLIED");
check(
  "SOFT_REJECTION@APPLIED → REJECTED, soft true, requiresConfirm true",
  p4 !== null &&
    p4.toStatus === "REJECTED" &&
    p4.soft === true &&
    p4.requiresConfirm === true,
);

// 5. Hard rejection → REJECTED, soft false.
const p5 = proposeStatusChange(mk("REJECTION"), "APPLIED");
check(
  "REJECTION@APPLIED → REJECTED, soft false",
  p5 !== null && p5.toStatus === "REJECTED" && p5.soft === false,
);

// 6. Application receipt forward from TO_APPLY → APPLIED, no confirm.
const p6 = proposeStatusChange(mk("APPLICATION_RECEIVED"), "TO_APPLY");
check(
  "APPLICATION_RECEIVED@TO_APPLY → APPLIED, requiresConfirm false",
  p6 !== null && p6.toStatus === "APPLIED" && p6.requiresConfirm === false,
);

// 7. Application receipt when already APPLIED → no-op.
check(
  "APPLICATION_RECEIVED@APPLIED → null (no-op)",
  proposeStatusChange(mk("APPLICATION_RECEIVED"), "APPLIED") === null,
);

// 8. Noise → no proposal.
check(
  "NOT_JOB → null",
  proposeStatusChange(mk("NOT_JOB"), "APPLIED") === null,
);

// 9. Recruiter lead → no proposal (not a status change on an existing app).
check(
  "RECRUITER_OUTREACH → null",
  proposeStatusChange(mk("RECRUITER_OUTREACH"), "APPLIED") === null,
);

// 10. Unlinked email (no currentStatus) → proposal with no fromStatus.
const p10: StatusProposal | null = proposeStatusChange(mk("INTERVIEW_INVITE"));
check(
  "INTERVIEW_INVITE@undefined → INTERVIEWING, fromStatus undefined",
  p10 !== null &&
    p10.toStatus === "INTERVIEWING" &&
    p10.fromStatus === undefined,
);

// --- Summary -----------------------------------------------------------------

console.log(`\nproposals ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
