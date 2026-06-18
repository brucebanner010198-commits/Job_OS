/**
 * Idempotent apply-state machine (Phase 5, plan §C).
 * Pure - no LLM, no network, no DB, no Math.random/Date.now.
 *
 * Uses APPLY_TRANSITIONS directly from types.ts; that table is the single
 * source of truth and is never redefined here.
 *
 * Crash-safety invariant (plan §8c, types.ts doc):
 *   SUBMITTING is only left by an explicit terminal result.  A process that
 *   crashes while SUBMITTING must NOT be auto-retried - we cannot know whether
 *   the form was already received by the employer.  isAutoRetryable returns
 *   false and resumeAction returns "manual" for SUBMITTING so a worker restart
 *   parks the row for human resolution instead of re-firing the submit.
 */
import type { ApplyState, ApplyEvent } from "@/lib/apply/types";
import { APPLY_TRANSITIONS } from "@/lib/apply/types";

/**
 * Look up the legal transition for (state, event).
 * Returns the target ApplyState, or null when the pair is not in the table.
 */
export function nextState(
  state: ApplyState,
  event: ApplyEvent,
): ApplyState | null {
  const target = APPLY_TRANSITIONS[state][event];
  return target ?? null;
}

/**
 * True for states with no outgoing transitions - the job is done or dead.
 * Currently: SUBMITTED and FAILED.
 */
export function isTerminal(state: ApplyState): boolean {
  return state === "SUBMITTED" || state === "FAILED";
}

/**
 * True when the engine may automatically resume this state on a worker restart.
 *
 * SUBMITTING → FALSE (crash-safety invariant):
 *   If a process dies while SUBMITTING, auto-retry risks a double-submission.
 *   A human must inspect the application portal and manually advance the row to
 *   SUBMITTED or reset it via FAILED → RESET → QUEUED.
 *
 * SUBMITTED / FAILED → false   (terminal; no resume needed)
 * QUEUED / PREPARING / REVIEW  → true  (no side-effect committed to employer)
 */
export function isAutoRetryable(state: ApplyState): boolean {
  switch (state) {
    case "QUEUED":
    case "PREPARING":
    case "REVIEW":
    case "PAUSED":
      return true;
    case "HANDOFF":
      return false;
    case "SUBMITTING": // crash-safety invariant - NEVER auto-retry
    case "SUBMITTED": // terminal
    case "FAILED": // terminal
      return false;
  }
}

/**
 * What a launchd / worker restart should do with a row in this state.
 *
 *   "resume" - safe to automatically pick up and continue processing.
 *   "manual" - SUBMITTING only: unknown submission state; a human must inspect
 *               the employer portal and resolve the row.  This is the runtime
 *               enforcement of the crash-safety invariant - the scheduler
 *               consults this value and never re-fires a submit automatically.
 *   "done"   - terminal state; no action required.
 */
export function resumeAction(
  state: ApplyState,
): "resume" | "manual" | "done" {
  if (state === "SUBMITTING") return "manual";
  if (state === "HANDOFF") return "manual";
  if (isTerminal(state)) return "done";
  return "resume";
}

/**
 * Returns every event that has a defined outgoing transition from `state`.
 * Useful for building UI affordances, logging, and validation guards.
 */
export function legalEvents(state: ApplyState): ApplyEvent[] {
  return Object.keys(APPLY_TRANSITIONS[state]) as ApplyEvent[];
}
