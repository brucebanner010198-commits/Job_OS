/**
 * Ghost-job detection - rules-first, deterministic, no LLM.
 *
 * Plan §8a: "~18-22% of postings are ghost jobs." Research-backed signals:
 * evergreen language, no concrete responsibilities, missing/absurd salary,
 * and generic "general application" titles are the strongest predictors.
 *
 * Each rule fires independently and contributes a weight in [0,1]; the final
 * score is the capped weighted sum. A score ≥ GHOST_THRESHOLD triggers
 * `flagged = true` → exclude from queue.
 *
 * The "borderline" seam (plan §8a footnote) is left as a documented gap: a
 * caller may pass borderline jobs (score in [0.35, GHOST_THRESHOLD)) to a
 * cheap LLM classifier. This module does not implement that pass.
 */

import type { RawJob, RiskAssessment } from "@/lib/jobs/types";

/**
 * Score threshold above which a job is considered a ghost posting.
 * Set at 0.35: catches clear ghosts (evergreen language, "no specific opening",
 * general applications) while keeping false-positive rate low. A single strong
 * signal (W_EVERGREEN=0.40, W_GENERAL_APPLICATION=0.45) always exceeds this.
 */
export const GHOST_THRESHOLD = 0.35;

// -- Individual rule weights ------------------------------------------------
// Each weight is the contribution to the final score when that rule fires.
// Weights sum to >1 so multiple weak signals together exceed the threshold.

const W_EVERGREEN = 0.40; // Strongest single signal
const W_NO_RESPONSIBILITIES = 0.35;
const W_MISSING_SALARY_SENIOR = 0.20;
const W_ABSURD_SALARY_BAND = 0.25;
const W_GENERAL_APPLICATION = 0.45;
const W_VERY_SHORT_DESC = 0.25;

/** Evergreen / talent-pool language patterns. */
const EVERGREEN_PATTERNS = [
  /\balways\s+hiring\b/i,
  /\btalent\s+community\b/i,
  /\btalent\s+pool\b/i,
  /\bwe['']?re\s+always\s+looking\b/i,
  /\bno\s+specific\s+opening\b/i,
  /\bjoin\s+our\s+talent\s+network\b/i,
  /\bpipeline\s+(role|posting|position)\b/i,
  /\bfuture\s+opportunities\b/i,
  /\bgeneral\s+interest\s+(form|application)\b/i,
];

/** General-application title patterns - not a real open role. */
const GENERAL_APPLICATION_TITLE_PATTERNS = [
  /^general\s+application$/i,
  /^open\s+application$/i,
  /^spontaneous\s+application$/i,
  /^talent\s+community$/i,
  /^talent\s+pool$/i,
  /^expression\s+of\s+interest$/i,
  /^join\s+our\s+team$/i,
];

/** Senior-level title signals - salary visibility matters more at these levels. */
const SENIOR_TITLE_PATTERNS =
  /\b(senior|sr\.?|lead|staff|principal|director|vp|vice\s+president|head\s+of|manager)\b/i;

/** Buzzword-only phrases with no concrete meaning. */
const BUZZWORD_ONLY_PATTERNS = [
  /\bpassionate\b/i,
  /\brock\s*star\b/i,
  /\bninja\b/i,
  /\bguru\b/i,
  /\bself[-\s]?starter\b/i,
  /\bdynamic\s+(team|environment|company)\b/i,
  /\bfast[-\s]paced\b/i,
  /\bthought\s+leader\b/i,
];

/** Minimum description length (words) for a "real" posting. */
const MIN_REAL_DESC_WORDS = 80;

/** Minimum description length (words) before we call it very short. */
const VERY_SHORT_DESC_WORDS = 30;

/**
 * Count words in a string (rough split on whitespace/punctuation runs).
 */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Assess whether a raw job is a ghost posting.
 * Returns a RiskAssessment with score in [0,1], human-readable reasons,
 * and flagged=true when score ≥ GHOST_THRESHOLD.
 */
export function assessGhost(raw: RawJob): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;

  const desc = raw.description ?? "";
  const title = raw.title ?? "";

  // -- Rule 1: Evergreen / pipeline language -----------------------------
  for (const pattern of EVERGREEN_PATTERNS) {
    if (pattern.test(desc) || pattern.test(title)) {
      reasons.push("Evergreen/pipeline language detected ('always hiring', talent pool, etc.)");
      score += W_EVERGREEN;
      break; // Only add once even if multiple patterns fire
    }
  }

  // -- Rule 2: General application title ---------------------------------
  for (const pattern of GENERAL_APPLICATION_TITLE_PATTERNS) {
    if (pattern.test(title.trim())) {
      reasons.push(`Title indicates a general application, not a specific open role: "${title}"`);
      score += W_GENERAL_APPLICATION;
      break;
    }
  }

  // -- Rule 3: Very short description ------------------------------------
  const wc = wordCount(desc);
  if (wc < VERY_SHORT_DESC_WORDS) {
    reasons.push(`Description is extremely short (${wc} words - likely a placeholder)`);
    score += W_VERY_SHORT_DESC;
  } else if (wc < MIN_REAL_DESC_WORDS) {
    // -- Rule 4: Short + buzzword-heavy (no concrete responsibilities) ----
    const buzzCount = BUZZWORD_ONLY_PATTERNS.filter((p) => p.test(desc)).length;
    const buzzRatio = buzzCount / BUZZWORD_ONLY_PATTERNS.length;
    if (buzzRatio >= 0.4) {
      reasons.push(
        `Description is short (${wc} words) and dominated by buzzwords - no concrete responsibilities`,
      );
      score += W_NO_RESPONSIBILITIES;
    }
  }

  // -- Rule 5: Missing salary on a senior role ----------------------------
  const isSenior = SENIOR_TITLE_PATTERNS.test(title);
  const hasSalary =
    raw.salaryMin !== undefined ||
    raw.salaryMax !== undefined ||
    /\$[\d,]+|\b\d{2,3}k\b|\bsalar/i.test(desc);

  if (isSenior && !hasSalary) {
    reasons.push("Senior-level role has no salary information (common in ghost/evergreen postings)");
    score += W_MISSING_SALARY_SENIOR;
  }

  // -- Rule 6: Absurdly wide salary band (max ≥ 4× min) ------------------
  if (
    raw.salaryMin !== undefined &&
    raw.salaryMax !== undefined &&
    raw.salaryMin > 0 &&
    raw.salaryMax >= raw.salaryMin * 4
  ) {
    reasons.push(
      `Salary band is implausibly wide ($${raw.salaryMin}–$${raw.salaryMax}, max ≥ 4× min)`,
    );
    score += W_ABSURD_SALARY_BAND;
  }

  // Cap at 1.0
  const finalScore = Math.min(score, 1.0);

  return {
    score: finalScore,
    reasons,
    flagged: finalScore >= GHOST_THRESHOLD,
  };
}
