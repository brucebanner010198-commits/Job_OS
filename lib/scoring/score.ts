/**
 * Top-level scoring composition (plan §8b).
 *
 * Pipeline:
 *   relevance  = goalAwareRelevance(jd, {resume, goals})   ← lib/scoring/relevance.ts
 *   reach      = reachability({jd, profile})               ← lib/scoring/reachability.ts
 *   gate       = hardGate({jd, hardFacts})                  ← lib/scoring/hard-gate.ts
 *   base       = RELEVANCE_WEIGHT × relevance + REACHABILITY_WEIGHT × reach
 *   capped     = gate.pass ? base : min(base, HARD_GATE_CEILING)
 *   bonus      = recencyBonus(firstSeenAt, now)             ← additive tiebreaker only
 *   score      = capped + bonus
 *
 * Weights rationale:
 *   RELEVANCE_WEIGHT  = 0.70 - semantic fit is the primary signal
 *   REACHABILITY_WEIGHT = 0.30 - attainability is important but secondary
 *   RECENCY_MAX = 0.05 - small enough that a weak fresh job can never overtake
 *                         a materially stronger older one (max lift = 0.05)
 *
 * Pure, deterministic - no LLM, no network, no DB, no Date.now.
 */
import type { AppScope } from "@/lib/profiles/types";
import type { ScoreInput, ScoredJob, ScoreExplain } from "@/lib/jobs/types";
import { goalAwareRelevance } from "@/lib/scoring/relevance";
import { goalAwareRelevanceAsync } from "@/lib/scoring/embedding-relevance";
import { reachability } from "@/lib/scoring/reachability";
import {
  hardGate,
  parseJobRequirements,
  HARD_GATE_CEILING,
} from "@/lib/scoring/hard-gate";

export { HARD_GATE_CEILING };

/** Maximum additive recency bonus - a tiebreaker, never a multiplier. */
export const RECENCY_MAX = 0.05;

/** Weight applied to the relevance axis in the base score. */
export const RELEVANCE_WEIGHT = 0.7;

/** Weight applied to the reachability axis in the base score. */
export const REACHABILITY_WEIGHT = 0.3;

const RECENCY_WINDOW_DAYS = 14;

/**
 * Additive recency tiebreaker in [0, RECENCY_MAX].
 * < 24 h → full bonus; decays linearly to 0 over ~14 days; never negative.
 * Dates are always passed in - no Date.now() calls.
 */
export function recencyBonus(firstSeenAt: Date, now: Date): number {
  const diffMs = now.getTime() - firstSeenAt.getTime();
  if (diffMs < 0) return RECENCY_MAX; // future timestamp → treat as fresh
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours <= 24) return RECENCY_MAX;
  const diffDays = diffHours / 24;
  if (diffDays >= RECENCY_WINDOW_DAYS) return 0;
  // Linear decay: RECENCY_MAX at day 1, 0 at day RECENCY_WINDOW_DAYS
  const span = RECENCY_WINDOW_DAYS - 1; // 13 days of decay after the first day
  return RECENCY_MAX * (1 - (diffDays - 1) / span);
}

/** Full scoring pipeline: relevance + reachability + gate + recency tiebreaker. */
export function scoreJob(input: ScoreInput): ScoredJob {
  return scoreJobWithRelevance(input, goalAwareRelevance(input.jobText, {
    resumeText: input.resumeText,
    goalText: input.goalText,
  }));
}

/**
 * Async scoring path - uses pgvector embeddings when OpenRouter is configured,
 * otherwise falls back to lexical relevance inside goalAwareRelevanceAsync.
 */
export async function scoreJobAsync(
  scope: AppScope,
  input: ScoreInput,
): Promise<ScoredJob> {
  const rel = await goalAwareRelevanceAsync(scope, input.jobText, {
    resumeText: input.resumeText,
    goalText: input.goalText,
  });
  const scored = scoreJobWithRelevance(input, rel);
  if (rel.mode === "embedding") {
    scored.explain.notes = [
      ...scored.explain.notes,
      "relevance: pgvector embedding cosine",
    ];
  }
  return scored;
}

function scoreJobWithRelevance(
  input: ScoreInput,
  rel: ReturnType<typeof goalAwareRelevance>,
): ScoredJob {
  const {
    jobText,
    profileText,
    hardFacts,
    firstSeenAt,
    now,
  } = input;

  // -- Reachability ----------------------------------------------------------
  const reach = reachability({ jobText, profileText });

  // -- Hard gate -------------------------------------------------------------
  const gate = hardGate({ jobText, hardFacts });

  // -- Base score (clamp to [0,1] before applying the gate ceiling) ----------
  const base = Math.max(
    0,
    Math.min(
      1,
      RELEVANCE_WEIGHT * rel.relevance + REACHABILITY_WEIGHT * reach.value,
    ),
  );
  const capped = gate.pass ? base : Math.min(base, gate.cappedTo);

  // -- Recency tiebreaker (additive; may push a top job slightly above 1) ----
  const bonus = recencyBonus(firstSeenAt, now);
  const score = capped + bonus;

  // -- Notes -----------------------------------------------------------------
  const notes: string[] = [...reach.notes];

  // "Verify" notes: requirement present in JD but candidate fact unknown.
  const req = parseJobRequirements(jobText);
  if (req.minDegree !== undefined && hardFacts.degree === undefined) {
    notes.push(
      `verify: role may require ${req.minDegree} degree - your degree level is not set`,
    );
  }
  if (req.requiresWorkAuth && hardFacts.workAuthorized === undefined) {
    notes.push(
      "verify: role may require US work authorization without sponsorship - your status is not set",
    );
  }

  // Freshness note.
  const diffHours =
    (now.getTime() - firstSeenAt.getTime()) / (1000 * 60 * 60);
  if (diffHours >= 0 && diffHours < 24) {
    notes.push("fresh <24h");
  }

  // -- Build explain ---------------------------------------------------------
  const explain: ScoreExplain = {
    relevance: rel.relevance,
    resumeRelevance: rel.resume,
    goalRelevance: rel.goals,
    relevanceDriver: rel.drivenBy,
    reachability: reach.value,
    caps: gate.caps,
    recencyBonus: bonus,
    notes,
  };

  return {
    score,
    relevance: rel.relevance,
    reachability: reach.value,
    relevanceDriver: rel.drivenBy,
    hardGatePass: gate.pass,
    explain,
  };
}
