/**
 * Hard-facts derivation from the candidate's non-sensitive profile text.
 *
 * Heuristic, best-effort, conservative. Every field is left `undefined` unless
 * the profile CLEARLY states it - unknowns must NOT cause a hard-gate cap
 * downstream (the gate fires only when a requirement is present AND clearly
 * unmet; undefined facts are neutral by design).
 *
 * Note: This is superseded in Phase 5 by ApplicationAnswers drawn from
 * confirmed user input. Use this only for opportunistic pre-screening. The
 * scoring hard-gate is designed to treat undefined as "unknown → no penalty",
 * so under-parsing is always safer than over-parsing.
 */
import type { HardFacts } from "@/lib/jobs/types";

/**
 * Parse the maximum "N years" mention from profile text.
 * Looks for patterns like "5 years of experience", "10+ years", "3 years work".
 */
function parseYearsExperience(text: string): number | undefined {
  // "N years [of experience]", "N+ years", "N years' experience"
  const re = /(\d+)\+?\s*years?(?:\s+of\s+(?:experience|work))?/gi;
  let max: number | undefined;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (!isNaN(n) && (max === undefined || n > max)) max = n;
  }
  return max;
}

/**
 * Derive best-effort HardFacts from the candidate's non-sensitive profile text.
 *
 * Conservative rule: leave a field `undefined` rather than guess. An undefined
 * field never triggers a hard-gate cap - only a clearly-unmet KNOWN fact does.
 */
export function deriveHardFacts(profileText: string): HardFacts {
  const lower = profileText.toLowerCase();

  // -- Highest degree --------------------------------------------------------
  // Match the strongest degree present; stop at the first match (top-down).
  let degree: string | undefined;
  if (/\bph\.?d\.?\b|\bdoctorate\b/.test(lower)) {
    degree = "phd";
  } else if (/\bmaster'?s?\b|\bm\.s\.\b|\bm\.a\.\b|\bmba\b/.test(lower)) {
    degree = "master";
  } else if (/\bbachelor'?s?\b|\bb\.s\.\b|\bb\.a\.\b/.test(lower)) {
    degree = "bachelor";
  } else if (/\bassociate'?s?\b/.test(lower)) {
    degree = "associate";
  }

  // -- Work authorization ----------------------------------------------------
  // Only assert true; never assert false - absence of mention is unknown, not denied.
  let workAuthorized: boolean | undefined;
  if (
    /authorized\s+to\s+work|us\s+citizen|green\s+card|permanent\s+resident/i.test(
      profileText,
    )
  ) {
    workAuthorized = true;
  }

  // -- Years of experience ---------------------------------------------------
  const yearsExperience = parseYearsExperience(profileText);

  // -- Security clearance ----------------------------------------------------
  // Only assert true; never assert false.
  let hasClearance: boolean | undefined;
  if (/security\s+clearance|ts\/sci|top\s+secret/i.test(profileText)) {
    hasClearance = true;
  }

  return {
    degree,
    workAuthorized,
    yearsExperience,
    hasClearance,
  };
}
