/**
 * Job-engine domain contract (Phase 3) - the single source of truth for the
 * shapes that cross module boundaries: sources → screen (dedupe/ghost/scam) →
 * score → queue. DB-decoupled and Prisma-free on purpose, so the pure brains
 * (sources, filter, scoring) can be unit-tested with no database and no network
 * and the UI can import these types on the client.
 *
 * Pipeline shape (plan §8):
 *   discover(query)            -> RawJob[]            (lib/jobs/sources)
 *   screen(RawJob[])           -> ScreenResult        (lib/jobs/filter)
 *   scoreJob(ScoreInput)       -> ScoredJob           (lib/scoring/score)
 *   runPipeline(...)           -> ScoredJob[]         (lib/jobs/pipeline)
 *
 * Every boundary function is PURE (no LLM, no DB, no network) so the phase
 * validation gate (scripts/test-job-pipeline.ts) is deterministic. The one
 * exception is the network fetch inside individual JobSource adapters, which is
 * isolated behind the JobSource interface and always optional (fixtures work
 * offline).
 */

// --- Discovery (lib/jobs/sources) -----------------------------------------

/**
 * A raw posting as pulled from a source, before any dedupe/ghost/scam/scoring.
 * Sources normalize their wire format into this shape. `description` is the
 * full JD text used for near-dup detection and scoring.
 */
export interface RawJob {
  /** Source adapter name, e.g. "fixtures" | "jsearch" | "remotive". */
  source: string;
  /** Source's own id if available - helps exact-dup detection within a source. */
  sourceId?: string;
  url?: string;
  company: string;
  title: string;
  location?: string;
  remote?: boolean;
  description: string;
  /** ATS/host family if detectable: "greenhouse" | "lever" | "workday" | … */
  atsType?: string;
  salaryMin?: number;
  salaryMax?: number;
  /** Posting date as reported by the source (untrusted - never a score multiplier). */
  postedAt?: Date;
}

/**
 * A discovery source. `fetch` is best-effort: a network source with no key or a
 * failed request returns [] (it never throws into the pipeline). `enabled`
 * lets the registry skip sources that aren't configured.
 */
export interface JobSource {
  name: string;
  /** True when this source is usable now (key present, flag on, or always for fixtures). */
  enabled(): boolean;
  fetch(query: string): Promise<RawJob[]>;
}

// --- Screen: dedupe + ghost + scam (lib/jobs/filter) ----------------------

export type ExcludeReason = "duplicate" | "ghost" | "scam";

/** Ghost/scam classification of a single posting - rules-first, explainable. */
export interface RiskAssessment {
  /** 0..1 - higher = more likely a ghost / scam. */
  score: number;
  /** Human-readable reasons that fired (empty when clean). */
  reasons: string[];
  /** True when score crosses the action threshold (drop from queue). */
  flagged: boolean;
}

/**
 * A posting after screening. Survivors carry their identity + near-dup
 * fingerprint and clean risk assessments; collapsed near-dups point at the
 * canonical they merged into. `excluded` survivors (ghost/scam) are kept for
 * the audit trail but never enter the queue.
 */
export interface ScreenedJob {
  raw: RawJob;
  /** Stable canonical company+title+location key (exact-dup collapse + DB unique). */
  identityHash: string;
  /** MinHash/LSH band signature over JD text (near-dup collapse). */
  fingerprint: string;
  ghost: RiskAssessment;
  scam: RiskAssessment;
  excluded: boolean;
  excludeReason?: ExcludeReason;
  /** When this is a near-dup, the identityHash of the canonical it collapsed into. */
  canonicalOf?: string;
}

export interface ScreenResult {
  /** Deduped postings that should be scored (excluded === false). */
  kept: ScreenedJob[];
  /** Everything dropped, with reasons - for the "why was this filtered" audit. */
  dropped: ScreenedJob[];
  stats: {
    total: number;
    duplicates: number;
    ghosts: number;
    scams: number;
    kept: number;
  };
}

// --- Scoring (lib/scoring) ------------------------------------------------

/**
 * Hard requirements the candidate is measured against by the hard-requirement
 * gate. Best-effort and OPTIONAL - an unknown field never hard-fails a job
 * (so career-changers aren't penalized); it only caps when a requirement is
 * clearly present in the JD AND clearly unmet by these facts.
 */
export interface HardFacts {
  yearsExperience?: number;
  /** Highest degree, lowercased: "phd" | "master" | "bachelor" | "associate" | "none". */
  degree?: string;
  /** True if the candidate asserts US work authorization (no sponsorship needed). */
  workAuthorized?: boolean;
  /** True if the candidate holds a security clearance. */
  hasClearance?: boolean;
  /** Locations the candidate can work from (cities/regions/"remote"). */
  locations?: string[];
}

export interface ScoreInput {
  jobText: string;
  resumeText: string;
  goalText: string;
  /** Non-sensitive profile blob for reachability + hard-facts context. */
  profileText: string;
  hardFacts: HardFacts;
  /** First-seen-in-our-DB time - drives the additive recency tiebreaker only. */
  firstSeenAt: Date;
  /** "Now" for recency math, injected for deterministic tests. */
  now: Date;
}

/** A hard-requirement cap that fired (plan §8b hard-gate). */
export interface HardCap {
  requirement: string;
  reason: string;
}

/**
 * Explainable score breakdown - plan §8b: "scores are explainable (shows
 * why)". Never collapse to a single opaque number in the UI; show this.
 */
export interface ScoreExplain {
  /** max(resume, goals) semantic relevance in [0,1]. */
  relevance: number;
  resumeRelevance: number;
  goalRelevance: number;
  relevanceDriver: "resume" | "goals" | "both";
  /** How attainable the role is in [0,1]. */
  reachability: number;
  /** Hard requirements that capped the score (empty when the gate passed). */
  caps: HardCap[];
  /** Additive recency tiebreaker in [0, RECENCY_MAX] - never a multiplier. */
  recencyBonus: number;
  /** Plain-language notes ("missing 2 of 6 years - verify", "fresh <24h"). */
  notes: string[];
}

export interface ScoredJob {
  /** Combined, hard-gate-capped, recency-tiebroken score the queue ranks by. */
  score: number;
  relevance: number;
  reachability: number;
  relevanceDriver: "resume" | "goals" | "both";
  hardGatePass: boolean;
  explain: ScoreExplain;
}

// --- Pipeline output (lib/jobs/pipeline) ----------------------------------

/** A screened posting joined with its score - the ranked-queue row shape. */
export interface RankedJob extends ScoredJob {
  screened: ScreenedJob;
}
