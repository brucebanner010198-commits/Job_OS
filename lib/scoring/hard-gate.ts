/**
 * Hard-requirement gate (plan §8b).
 *
 * Caps a job's score to HARD_GATE_CEILING when a requirement is clearly
 * PRESENT in the JD AND clearly UNMET by the candidate's HardFacts.
 *
 * Key rule: unknown/unparseable/absent facts → NO cap. We do not penalise
 * career-changers or candidates who haven't filled in every field.
 *
 * Requirements parsed:
 *   • Minimum years of experience
 *   • Minimum degree level
 *   • US work authorisation (no sponsorship)
 *   • Security clearance
 *
 * Pure, deterministic - no LLM, no network, no DB.
 */
import type { HardFacts, HardCap } from "@/lib/jobs/types";

/** Jobs that fail the gate are capped to this score before recency is added. */
export const HARD_GATE_CEILING = 0.35;

// -- Degree ranking -----------------------------------------------------------

const DEGREE_RANK: Record<string, number> = {
  phd: 4,
  master: 3,
  bachelor: 2,
  associate: 1,
  none: 0,
};

// -- Individual requirement parsers -------------------------------------------

/** Find the highest explicit years-of-experience requirement in JD text. */
function parseMinYears(jobText: string): number | undefined {
  // "10+ years", "8+ years of experience", "10+ years' experience"
  const plusYears = /\b(\d+)\+\s*years?/gi;
  // "minimum 5 years", "at least 7 years", "minimum of 5 years"
  const minYears =
    /\b(?:minimum|at\s+least)(?:\s+of)?\s+(\d+)\s+years?/gi;
  // "requires 5 years of …"
  const requiresYears =
    /\b(?:requires?|require)\s+(\d+)\s+years?/gi;

  let max: number | undefined;
  const capture = (re: RegExp): void => {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(jobText)) !== null) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n) && (max === undefined || n > max)) max = n;
    }
  };
  capture(plusYears);
  capture(minYears);
  capture(requiresYears);
  return max;
}

/** Determine the minimum degree required by the JD, or undefined. */
function parseMinDegree(jobText: string): string | undefined {
  if (/ph\.?d\.?\s+(?:required|in\b)|doctorate\s+required/i.test(jobText)) {
    return "phd";
  }
  if (
    /master'?s?\s+(?:degree\s+)?required|m\.s\.\s+required|ms\s+required/i.test(
      jobText,
    )
  ) {
    return "master";
  }
  if (
    /bachelor'?s?\s+(?:degree\s+)?required|b\.s\.\s+(?:required|degree)|degree\s+required/i.test(
      jobText,
    )
  ) {
    return "bachelor";
  }
  if (/associate'?s?\s+(?:degree\s+)?required/i.test(jobText)) {
    return "associate";
  }
  return undefined;
}

/** True when the JD clearly requires US work authorisation without sponsorship. */
function jobRequiresWorkAuth(jobText: string): boolean {
  return /must\s+be\s+authorized\s+to\s+work|without\s+(?:visa\s+)?sponsorship|us\s+citizens?\s+(?:only|required)|no\s+(?:visa\s+)?sponsorship/i.test(
    jobText,
  );
}

/** True when the JD clearly requires an active security clearance. */
function jobRequiresClearance(jobText: string): boolean {
  return /active\s+security\s+clearance|ts\/sci|top\s+secret|secret\s+clearance|must\s+hold\s+a\s+clearance/i.test(
    jobText,
  );
}

// -- Public helpers -----------------------------------------------------------

/** Parsed set of hard requirements from the JD - exported for score.ts verify-notes. */
export interface ParsedRequirements {
  minYears: number | undefined;
  minDegree: string | undefined;
  requiresWorkAuth: boolean;
  requiresClearance: boolean;
}

export function parseJobRequirements(jobText: string): ParsedRequirements {
  return {
    minYears: parseMinYears(jobText),
    minDegree: parseMinDegree(jobText),
    requiresWorkAuth: jobRequiresWorkAuth(jobText),
    requiresClearance: jobRequiresClearance(jobText),
  };
}

// -- Main gate function -------------------------------------------------------

export function hardGate(opts: {
  jobText: string;
  hardFacts: HardFacts;
}): {
  pass: boolean;
  caps: HardCap[];
  cappedTo: number;
} {
  const { jobText, hardFacts } = opts;
  const req = parseJobRequirements(jobText);
  const caps: HardCap[] = [];

  // -- Years of experience --------------------------------------------------
  if (req.minYears !== undefined && hardFacts.yearsExperience !== undefined) {
    if (hardFacts.yearsExperience < req.minYears) {
      caps.push({
        requirement: `Minimum ${req.minYears}+ years of experience`,
        reason: `Requires ${req.minYears}+ years (you have ${hardFacts.yearsExperience})`,
      });
    }
  }

  // -- Degree ---------------------------------------------------------------
  if (req.minDegree !== undefined && hardFacts.degree !== undefined) {
    const required = DEGREE_RANK[req.minDegree] ?? 0;
    const held = DEGREE_RANK[hardFacts.degree] ?? 0;
    if (held < required) {
      const reqLabel =
        req.minDegree.charAt(0).toUpperCase() + req.minDegree.slice(1);
      caps.push({
        requirement: `${reqLabel} degree required`,
        reason: `Requires ${req.minDegree} (you have ${hardFacts.degree})`,
      });
    }
  }

  // -- Work authorisation ---------------------------------------------------
  if (req.requiresWorkAuth && hardFacts.workAuthorized === false) {
    caps.push({
      requirement: "US work authorization required (no sponsorship)",
      reason: "Role requires authorization to work in the US without sponsorship",
    });
  }

  // -- Security clearance ---------------------------------------------------
  if (req.requiresClearance && hardFacts.hasClearance === false) {
    caps.push({
      requirement: "Active security clearance required",
      reason: "Role requires an active security clearance you do not hold",
    });
  }

  const pass = caps.length === 0;
  return {
    pass,
    caps,
    cappedTo: pass ? 1 : HARD_GATE_CEILING,
  };
}
