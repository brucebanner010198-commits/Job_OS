/**
 * Knockout evaluation (plan §8c).
 *
 * Runs BEFORE any form interaction. If the candidate is clearly auto-disqualified
 * by a hard JD requirement, the engine skips the submit entirely.
 *
 * Key rule (plan §C): UNKNOWN answers never produce a failure. We only fail when
 * BOTH the JD requirement is present AND the candidate's answer clearly fails it.
 * Missing/undefined answers are treated as "we don't know" → no disqualification.
 *
 * Pure, deterministic - no LLM, no network, no DB.
 */

import type {
  ApplicationAnswersData,
  KnockoutResult,
  KnockoutFailure,
} from "@/lib/apply/types";
import { parseJobRequirements } from "@/lib/scoring/hard-gate";

export function evaluateKnockouts(input: {
  jobText: string;
  answers: ApplicationAnswersData;
}): KnockoutResult {
  const { jobText, answers } = input;
  const req = parseJobRequirements(jobText);
  const failures: KnockoutFailure[] = [];

  // -- Years of experience ----------------------------------------------------
  // Only fails when BOTH sides are defined and the candidate clearly falls short.
  if (
    req.minYears !== undefined &&
    answers.yearsExperience !== undefined &&
    answers.yearsExperience < req.minYears
  ) {
    failures.push({
      requirement: `Minimum ${req.minYears}+ years of experience`,
      reason: `Role requires ${req.minYears}+ years; you have ${answers.yearsExperience}`,
    });
  }

  // -- Degree -----------------------------------------------------------------
  // ApplicationAnswersData has no degree field - we can only note "verify" at
  // review time. Skip as a hard knockout per plan: do NOT fail without the field.

  // -- Work authorization / no sponsorship -----------------------------------
  // Fails when the JD explicitly forbids sponsorship AND the candidate either
  // is not authorized or requires sponsorship. Unknown (undefined) → no failure.
  if (req.requiresWorkAuth) {
    if (answers.workAuthorized === false) {
      failures.push({
        requirement: "US work authorization required (no sponsorship)",
        reason: "You are not authorized to work in the US without sponsorship",
      });
    } else if (answers.requiresSponsorship === true) {
      failures.push({
        requirement: "US work authorization required (no sponsorship)",
        reason: "Role does not offer visa sponsorship but you require it",
      });
    }
  }

  // -- Security clearance -----------------------------------------------------
  // Fails only when the JD requires clearance AND the candidate explicitly
  // answered false. undefined → no failure.
  if (req.requiresClearance && answers.hasClearance === false) {
    failures.push({
      requirement: "Active security clearance required",
      reason: "Role requires an active security clearance you do not hold",
    });
  }

  return {
    disqualified: failures.length > 0,
    failures,
  };
}
