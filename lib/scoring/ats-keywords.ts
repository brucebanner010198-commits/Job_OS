/**
 * Lexical ATS keyword match MVP - no LLM, no new API deps.
 * Surfaces match % + gap list (Jobscan parity without keyword stuffing).
 */

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "will", "are", "have",
  "this", "that", "from", "into", "about", "their", "they", "been", "being",
  "would", "should", "could", "must", "able", "work", "team", "role", "job",
  "experience", "years", "including", "using", "such", "other", "more", "than",
]);

/** Skill-like tokens from JD text (2+ chars, not stop words). */
export function extractJdKeywords(jobDescription: string): string[] {
  const tokens = jobDescription
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([t]) => t);
}

export interface AtsMatchResult {
  matchPercent: number;
  matched: string[];
  gaps: string[];
  totalKeywords: number;
}

/** Lexical overlap between JD keywords and resume/profile text. */
export function computeAtsMatch(
  jobDescription: string,
  resumeText: string,
): AtsMatchResult {
  const keywords = extractJdKeywords(jobDescription);
  if (keywords.length === 0) {
    return { matchPercent: 0, matched: [], gaps: [], totalKeywords: 0 };
  }

  const resumeLower = resumeText.toLowerCase();
  const matched: string[] = [];
  const gaps: string[] = [];

  for (const kw of keywords) {
    if (resumeLower.includes(kw)) matched.push(kw);
    else gaps.push(kw);
  }

  const matchPercent = Math.round((matched.length / keywords.length) * 100);
  return {
    matchPercent,
    matched,
    gaps: gaps.slice(0, 15),
    totalKeywords: keywords.length,
  };
}
