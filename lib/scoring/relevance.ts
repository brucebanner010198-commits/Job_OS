/**
 * Relevance scoring - the seam where career goals enter the job engine.
 *
 * Plan §8b: relevance is the semantic match of a job description against
 * `max(resume, career-goals)` - so a job is surfaced if it fits where you've
 * BEEN or where you're GOING. This module computes that with a lightweight,
 * dependency-free LEXICAL proxy today; Phase 3 swaps `axisSimilarity` for a
 * pgvector embedding cosine without changing any caller. The two-axis,
 * max-of, explainable shape is the contract that stays.
 *
 * No LLM, no network, fully deterministic - which is exactly what lets the
 * goal re-ranking be proven by a unit test (scripts/test-goal-rerank.ts).
 */

/** English stopwords + resume/JD boilerplate that carry no matching signal. */
const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
  "has", "this", "that", "from", "but", "not", "all", "can", "who", "what",
  "their", "them", "they", "his", "her", "its", "out", "into", "over", "more",
  "most", "such", "than", "then", "now", "via", "per", "able", "across",
  "a", "an", "as", "at", "be", "by", "in", "is", "it", "of", "on", "or", "to",
  "we", "us", "i", "im", "ive", "etc", "e", "g", "ie",
  "role", "team", "work", "working", "experience", "years", "year", "job",
  "company", "ability", "strong", "including", "include", "well", "looking",
  "join", "help", "build", "building", "make", "using", "use", "used",
]);

/**
 * Split text into a set of meaningful, normalized tokens. Keeps `+`/`#` so
 * "c++" and "c#" survive as distinct skill tokens; strips only sentence-period
 * punctuation from the ends (so "team." → "team" but "node.js" stays intact).
 */
export function tokenSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#.]+/)) {
    const t = raw.replace(/^\.+|\.+$/g, "");
    if (t.length < 2) continue;
    if (STOPWORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

/**
 * Similarity of a job against one axis of text, in [0, 1].
 *
 * Weighted token overlap: of the job's meaningful tokens, what fraction are
 * also in the axis (recall-of-job, so a long resume/goal blob doesn't dilute
 * the score). This is the function Phase 3 replaces with an embedding cosine.
 */
export function axisSimilarity(jobText: string, axisText: string): number {
  const job = tokenSet(jobText);
  if (job.size === 0) return 0;
  const axis = tokenSet(axisText);
  if (axis.size === 0) return 0;
  let hit = 0;
  for (const t of job) if (axis.has(t)) hit++;
  return hit / job.size;
}

export type RelevanceDriver = "resume" | "goals" | "both";

export interface RelevanceResult {
  /** max(resume, goals) similarity in [0, 1]. */
  relevance: number;
  resume: number;
  goals: number;
  /** Which axis carried the score - drives the "why" in explanations. */
  drivenBy: RelevanceDriver;
}

const DRIVER_EPSILON = 0.02;

/**
 * Goal-aware relevance: a job is as relevant as the better of its fit to the
 * candidate's history (resume) and to their stated direction (goals).
 * `drivenBy` makes the result explainable (plan §8b: "shows why").
 */
export function goalAwareRelevance(
  jobText: string,
  axes: { resumeText: string; goalText: string },
): RelevanceResult {
  const resume = axisSimilarity(jobText, axes.resumeText);
  const goals = axisSimilarity(jobText, axes.goalText);
  const relevance = Math.max(resume, goals);

  let drivenBy: RelevanceDriver;
  if (Math.abs(resume - goals) <= DRIVER_EPSILON) drivenBy = "both";
  else drivenBy = resume > goals ? "resume" : "goals";

  return { relevance, resume, goals, drivenBy };
}
