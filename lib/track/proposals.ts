/**
 * Status-change PROPOSER (Phase 6, plan §8d - Track safety spine).
 * Pure - no LLM, no DB, no network, no wall-clock reads. Maps a
 * ClassificationResult (+ the app's current status) to a single PROPOSED
 * AppStatus move, or null when no move is warranted.
 *
 * Safety spine: this module only ever PROPOSES. A move into INTERVIEWING /
 * OFFER / REJECTED (NEVER_AUTO_STATUSES) carries requiresConfirm=true so the
 * human is always the gate. Non-rejection targets are forward-only (we never
 * regress a pipeline column); a REJECTED close-out may be reached from any
 * status. The already-at-target case is always a no-op.
 */
import type {
  AppStatus,
  ClassificationResult,
  EmailCategory,
  StatusProposal,
} from "@/lib/track/types";
import { BOARD_COLUMNS, NEVER_AUTO_STATUSES } from "@/lib/track/types";

/**
 * Pipeline rank of a status: WARM_PATH 0 .. REJECTED 5. SKIPPED is not a board
 * column, so indexOf yields -1 (it sorts before every real column).
 */
function rank(status: AppStatus): number {
  return BOARD_COLUMNS.indexOf(status);
}

/**
 * The status a category proposes, or null when the category never drives a
 * status change (RECRUITER_OUTREACH is a lead, NOT_JOB is noise). Exhaustive
 * over EmailCategory so a new category is a compile error here.
 */
function targetStatusFor(category: EmailCategory): AppStatus | null {
  switch (category) {
    case "INTERVIEW_INVITE":
    case "ASSESSMENT":
      return "INTERVIEWING";
    case "OFFER":
      return "OFFER";
    case "REJECTION":
    case "SOFT_REJECTION":
      return "REJECTED";
    case "APPLICATION_RECEIVED":
      return "APPLIED";
    case "RECRUITER_OUTREACH":
    case "NOT_JOB":
      return null;
  }
}

/** Human label for a status, used inside the one-line rationale. */
function statusLabel(status: AppStatus): string {
  switch (status) {
    case "WARM_PATH":
      return "Warm Path";
    case "TO_APPLY":
      return "To Apply";
    case "APPLIED":
      return "Applied";
    case "INTERVIEWING":
      return "Interviewing";
    case "OFFER":
      return "Offer";
    case "REJECTED":
      return "Rejected";
    case "SKIPPED":
      return "Skipped";
  }
}

/** The signal phrase that opens the rationale for each proposing category. */
function categoryReason(category: EmailCategory): string {
  switch (category) {
    case "INTERVIEW_INVITE":
      return "Interview invite detected";
    case "ASSESSMENT":
      return "Assessment request detected";
    case "OFFER":
      return "Offer detected";
    case "REJECTION":
      return "Rejection detected";
    case "SOFT_REJECTION":
      return "Soft rejection detected";
    case "APPLICATION_RECEIVED":
      return "Application receipt detected";
    case "RECRUITER_OUTREACH":
    case "NOT_JOB":
      // Never reached: these categories return a null target before we build a
      // rationale. Kept for an exhaustive switch.
      return "Job email detected";
  }
}

function buildRationale(
  category: EmailCategory,
  target: AppStatus,
  fromStatus?: AppStatus,
): string {
  const reason = categoryReason(category);
  const to = statusLabel(target);
  if (fromStatus === undefined) {
    return `${reason} - set status to ${to}?`;
  }
  return `${reason} - move ${statusLabel(fromStatus)} -> ${to}?`;
}

/**
 * Propose a status change for a classified email, or null when none is
 * warranted. `currentStatus` is the app's status today; omit it when the email
 * is not yet linked to an application (the proposal then carries no fromStatus).
 *
 * Guards (only applied when currentStatus is known):
 *   - already at target            → null (no-op)
 *   - non-rejection target, not a forward move (rank(current) >= rank(target))
 *                                  → null (never regress the pipeline)
 *   - REJECTED target              → allowed from any status (no-op handled)
 */
export function proposeStatusChange(
  classification: ClassificationResult,
  currentStatus?: AppStatus,
): StatusProposal | null {
  const target = targetStatusFor(classification.category);
  if (target === null) return null;

  if (currentStatus !== undefined) {
    if (currentStatus === target) return null;
    if (target !== "REJECTED" && rank(currentStatus) >= rank(target)) {
      return null;
    }
  }

  return {
    toStatus: target,
    fromStatus: currentStatus,
    rationale: buildRationale(classification.category, target, currentStatus),
    requiresConfirm: NEVER_AUTO_STATUSES.has(target),
    soft: classification.category === "SOFT_REJECTION",
  };
}
