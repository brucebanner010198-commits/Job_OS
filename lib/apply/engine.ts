/**
 * Apply-engine composer (Phase 5) - PURE, no DB, no LLM, no network.
 *
 * `buildApplyPlan` composes the four brain modules into a single plan:
 *   evaluateKnockouts → planFields → scanPage → routeApplication → nextState
 *
 * Key safety properties (plan §8c / §A / §C):
 *   1. If the candidate is knocked out, nextState is "FAILED" and the submit
 *      path is structurally blocked - canSubmit("FAILED") returns false.
 *   2. `canSubmit` is the human-approval gate guard: submit is only legal when
 *      the application is in REVIEW. Every other state returns false.
 *   3. The router forces MANUAL on knockout, but nextState="FAILED" is the
 *      secondary guard so the submit path is doubly blocked.
 *
 * Note on AUTONOMOUS: buildApplyPlan calls planFields, which always emits
 * critical fields (workAuthorization, salaryExpectation, clearance, etc.).
 * Because the router's §A condition-2 blocks AUTONOMOUS when any critical
 * field is present, buildApplyPlan will never return route:AUTONOMOUS in
 * practice. This is intentional - AUTONOMOUS is structurally rare, and the
 * review gate is the safe default for all real applications. AUTONOMOUS can
 * be demonstrated by calling routeApplication directly with manually-crafted
 * non-critical fields (see scripts/test-apply.ts).
 */

import { evaluateKnockouts } from "@/lib/apply/knockout";
import { planFields } from "@/lib/apply/fields";
import { scanPage } from "@/lib/apply/detection";
import { routeApplication } from "@/lib/apply/router";
import type {
  ApplyPlan,
  ApplyState,
  ApplicationAnswersData,
  PageSignals,
} from "@/lib/apply/types";

export interface BuildApplyPlanInput {
  /** Full job description text - fed to knockout evaluator and field planner. */
  jobText: string;
  answers: ApplicationAnswersData;
  contact: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
  /** Page signals for the runtime detection scan. Use a default-clean signal for offline prep. */
  signals: PageSignals;
  /** True when running locally on a residential connection (cloud auto-disables autonomy). */
  local: boolean;
  /** Source/ATS family, lowercased: "dice" | "wellfound" | "greenhouse" | "workday" | "linkedin" | … */
  surface: string;
}

/**
 * Compose the four brain modules into a complete apply plan.
 *
 * Composition order (mirrors the router's check order so results are consistent):
 *   1. evaluateKnockouts - disqualification runs first; a knocked-out candidate
 *      is never submitted regardless of route or field plan.
 *   2. planFields       - build the itemized review-gate rows (label→value→source→confidence).
 *   3. scanPage         - classify PageSignals into a DetectionResult.
 *   4. routeApplication - decide AUTONOMOUS / ASSISTED / MANUAL.
 *   5. nextState        - FAILED if disqualified (blocks submit), REVIEW otherwise.
 */
export function buildApplyPlan(input: BuildApplyPlanInput): ApplyPlan {
  const { jobText, answers, contact, signals, local, surface } = input;

  const knockouts = evaluateKnockouts({ jobText, answers });
  const fields = planFields({ jobText, answers, contact });
  const detection = scanPage(signals);
  const decision = routeApplication({ surface, fields, detection, knockouts, local });

  // Safety: a disqualified candidate parks at FAILED, never REVIEW.
  // The router also forces MANUAL for disqualified candidates (rule 1 in
  // router.ts), so MANUAL + FAILED is the double guard against any submit.
  const nextApplyState: ApplyState = knockouts.disqualified ? "FAILED" : "REVIEW";

  return {
    route: decision.route,
    routeReasons: decision.reasons,
    knockouts,
    detection,
    fields,
    nextState: nextApplyState,
  };
}

/**
 * Human-approval gate guard (plan §8c / §C).
 *
 * Returns true ONLY when the application is parked at REVIEW - the state a
 * freshly-prepared, non-disqualified app enters after the AI has laid out every
 * field for the human to inspect and confirm. Submit is only reachable from
 * REVIEW via APPROVE → SUBMITTING; no other path leads to SUBMITTING.
 *
 *   canSubmit("REVIEW")     → true   (human has seen and can approve the itemized gate)
 *   canSubmit("FAILED")     → false  (disqualified - structurally blocked)
 *   canSubmit("SUBMITTED")  → false  (already done - idempotent guard)
 *   canSubmit("SUBMITTING") → false  (in flight - concurrency guard)
 *   canSubmit("QUEUED")     → false  (not yet prepared)
 *   canSubmit("PREPARING")  → false  (in progress)
 */
export function canSubmit(state: ApplyState): boolean {
  return state === "REVIEW";
}
