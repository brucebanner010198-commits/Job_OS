/**
 * Reachability - how attainable a role is for this candidate.
 *
 * Two axes, combined 50/50:
 *   (a) SENIORITY DISTANCE: gap between job level and candidate level.
 *       Lateral or downward → 1.0; each level reach-up degrades it.
 *       Unknown seniority on either side → neutral 0.5 (not 0, to avoid
 *       penalising career-changers who haven't used seniority language yet).
 *   (b) SKILL COVERAGE: fraction of the job's meaningful tokens that appear
 *       in the candidate's profile text.
 *
 * Pure, deterministic - no LLM, no network, no DB.
 */
import { tokenSet } from "@/lib/scoring/relevance";

/** 0 = intern … 6 = vp/executive */
type SeniorityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
  0: "intern",
  1: "junior",
  2: "mid",
  3: "senior",
  4: "staff/lead/manager",
  5: "principal/director",
  6: "vp/executive",
};

/**
 * Scan text for the most prominent seniority signal.
 * Returns null when no clear keyword is found - caller must treat null as
 * "unknown" (neutral 0.5 contribution, never a hard penalty).
 */
function detectSeniority(text: string): SeniorityLevel | null {
  const lo = text.toLowerCase();
  // Most specific patterns first to avoid shadowing.
  if (/\bintern\b/.test(lo)) return 0;
  if (/\bjunior\b|\bentry[- ]level\b/.test(lo)) return 1;
  if (/\bmid[- ]level\b/.test(lo)) return 2;
  if (/\b(svp|evp)\b/.test(lo)) return 6;
  if (/\bvp\b/.test(lo)) return 6;
  if (/\bvice\s+president\b/.test(lo)) return 6;
  if (/\bprincipal\b/.test(lo)) return 5;
  if (/\bdirector\b/.test(lo)) return 5;
  if (/\bstaff\b/.test(lo)) return 4;
  if (/\bmanager\b/.test(lo)) return 4;
  if (/\blead\b/.test(lo)) return 4;
  if (/\bsenior\b/.test(lo)) return 3;
  return null;
}

/**
 * Translate a seniority gap into a [0,1] reach value plus a human note.
 * Rule: 1.0 for lateral/downward; −0.2 per level of upward reach; floor 0.1.
 * Unknown → 0.5 (neutral), no note emitted.
 */
function seniorityReach(
  jobLevel: SeniorityLevel | null,
  candidateLevel: SeniorityLevel | null,
): { value: number; notes: string[] } {
  if (jobLevel === null || candidateLevel === null) {
    return { value: 0.5, notes: [] };
  }
  const gap = jobLevel - candidateLevel;
  if (gap <= 0) {
    return {
      value: 1.0,
      notes: [
        `lateral or step-down (${SENIORITY_LABELS[candidateLevel]} → ${SENIORITY_LABELS[jobLevel]})`,
      ],
    };
  }
  const value = Math.max(0.1, 1.0 - gap * 0.2);
  return {
    value,
    notes: [
      `${gap} level${gap > 1 ? "s" : ""} reach up (${SENIORITY_LABELS[candidateLevel]} → ${SENIORITY_LABELS[jobLevel]})`,
    ],
  };
}

/** Reachability score in [0,1] with human-readable notes explaining why. */
export function reachability(opts: {
  jobText: string;
  profileText: string;
}): { value: number; notes: string[] } {
  const { jobText, profileText } = opts;

  // -- (a) Seniority distance ---------------------------------------------
  const jobLevel = detectSeniority(jobText);
  const candidateLevel = detectSeniority(profileText);
  const sen = seniorityReach(jobLevel, candidateLevel);

  // -- (b) Skill coverage ------------------------------------------------
  const jobTokens = tokenSet(jobText);
  let skillValue: number;
  const coverageNotes: string[] = [];

  if (jobTokens.size === 0) {
    skillValue = 0.5; // no signal → neutral
  } else {
    const profileTokens = tokenSet(profileText);
    let hits = 0;
    for (const t of jobTokens) {
      if (profileTokens.has(t)) hits++;
    }
    skillValue = hits / jobTokens.size;
    coverageNotes.push(`covers ${hits} of ${jobTokens.size} key terms`);
  }

  // -- Combine ------------------------------------------------------------
  const raw = 0.5 * sen.value + 0.5 * skillValue;
  return {
    value: Math.max(0, Math.min(1, raw)),
    notes: [...sen.notes, ...coverageNotes],
  };
}
