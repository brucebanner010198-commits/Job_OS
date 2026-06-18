/**
 * Apply autonomy router (Phase 5, Hardening §A).
 *
 * `routeApplication` decides AUTONOMOUS | ASSISTED | MANUAL for a job.
 * AUTONOMOUS is the rare, narrowly-gated lane; ASSISTED is the safe default.
 * Never throws - safety-critical paths must remain stable under any input.
 *
 * Rule (Hardening §A): AUTONOMOUS only when ALL six conditions hold:
 *   1. Surface is TOLERANT (Dice, Wellfound, email/mailto, company-simple).
 *   2. Zero critical fields (PreparedField.critical === true disqualifies).
 *   3. Zero free-text/essay fields (PreparedField.freeText === true disqualifies).
 *   4. Runtime detection scan is clean (DetectionResult.clean === true).
 *   5. Candidate is NOT knocked out (KnockoutResult.disqualified === false).
 *   6. Running locally on a residential connection (RouteInput.local === true).
 *
 * Check order in routeApplication:
 *   1. knockout disqualified → MANUAL  (never waste a submit on a disqualified candidate)
 *   2. blocked surface       → MANUAL  (LinkedIn / Workday - always skip)
 *   3. all six §A conditions → AUTONOMOUS iff all pass, else ASSISTED
 */

import type { RouteInput, RouteDecision } from "@/lib/apply/types";
import { classifySurface } from "@/lib/apply/surfaces";

/**
 * Returns every reason autonomy was denied for this input.
 *
 * The list is EMPTY if and only if `routeApplication` would return AUTONOMOUS.
 * Useful for the UI to explain "why can't this be auto-submitted?".
 *
 * Covers all six §A conditions plus disqualification and blocked surfaces so
 * the caller gets the full picture regardless of which MANUAL/ASSISTED branch
 * was taken.
 */
export function autonomyBlockers(input: RouteInput): string[] {
  const blockers: string[] = [];

  // Condition 5 - knockout disqualification
  if (input.knockouts.disqualified) {
    blockers.push("candidate is knocked out / disqualified");
  }

  // Condition 1 - surface tier
  const tier = classifySurface(input.surface);
  if (tier === "blocked") {
    blockers.push(`surface '${input.surface}' is blocked (always MANUAL)`);
  } else if (tier === "standard") {
    blockers.push(
      `surface '${input.surface}' is standard (not in TOLERANT_SURFACES) → ASSISTED`,
    );
  }

  // Condition 2 - critical fields
  const criticalFields = input.fields.filter((f) => f.critical);
  if (criticalFields.length > 0) {
    blockers.push(
      `${criticalFields.length} critical field(s) present: ${criticalFields
        .map((f) => f.key)
        .join(", ")}`,
    );
  }

  // Condition 3 - free-text / essay fields
  const freeTextFields = input.fields.filter((f) => f.freeText);
  if (freeTextFields.length > 0) {
    blockers.push(
      `${freeTextFields.length} free-text/essay field(s) present: ${freeTextFields
        .map((f) => f.key)
        .join(", ")}`,
    );
  }

  // Condition 4 - detection scan
  if (!input.detection.clean) {
    const sigs =
      input.detection.signals.length > 0
        ? input.detection.signals.join(", ")
        : "unknown signals";
    blockers.push(`detection scan not clean: ${sigs}`);
  }

  // Condition 6 - local execution
  if (!input.local) {
    blockers.push(
      "not running locally (cloud execution - autonomy auto-disabled)",
    );
  }

  return blockers;
}

/**
 * Route a job application to AUTONOMOUS, ASSISTED, or MANUAL.
 *
 * The `reasons` array is always fully populated with the deciding factors so
 * logs and the UI can explain why each route was chosen.
 *
 * Check order:
 *   1. knockout disqualified → MANUAL
 *   2. blocked surface       → MANUAL
 *   3. all §A conditions     → AUTONOMOUS iff all pass, else ASSISTED
 */
export function routeApplication(input: RouteInput): RouteDecision {
  // -- 1. Knockout disqualification -------------------------------------------
  if (input.knockouts.disqualified) {
    const failureList = input.knockouts.failures
      .map((f) => f.requirement)
      .join("; ");
    return {
      route: "MANUAL",
      reasons: [
        `candidate is disqualified (knockout) → MANUAL${
          failureList ? `: ${failureList}` : ""
        }`,
      ],
    };
  }

  // -- 2. Blocked surface -----------------------------------------------------
  const tier = classifySurface(input.surface);
  if (tier === "blocked") {
    return {
      route: "MANUAL",
      reasons: [`surface '${input.surface}' is blocked → MANUAL`],
    };
  }

  // -- 3. AUTONOMOUS gate (all six §A conditions must hold) -------------------
  // At this point: not disqualified, not blocked surface.
  // autonomyBlockers re-checks all conditions; any remaining blocker → ASSISTED.
  const blockers = autonomyBlockers(input);
  if (blockers.length === 0) {
    return {
      route: "AUTONOMOUS",
      reasons: ["all autonomy conditions met → AUTONOMOUS"],
    };
  }

  // Default safe fallback - ASSISTED for anything that passed the MANUAL gates
  // but didn't clear the full §A bar.
  return {
    route: "ASSISTED",
    reasons: blockers.map((b) => `${b} → ASSISTED`),
  };
}
