/**
 * Pure job-pipeline orchestrator (plan §8 Phase 3). No DB, no network, no LLM.
 * Composes screen → scoreJob into a deterministic, testable pipeline.
 *
 * Used by both the live ingest (lib/jobs/service.ts - Prisma layer) and the
 * offline preview (DB-less environments and empty-queue graceful degradation).
 * The pure shape means scripts/test-job-pipeline.ts can validate the full
 * pipeline with no infrastructure.
 */
import type {
  RawJob,
  ScreenedJob,
  ScoredJob,
  HardFacts,
  ScreenResult,
} from "@/lib/jobs/types";
import { screen } from "@/lib/jobs/filter";
import { previewRouteFromJob } from "@/lib/pipeline/route-preview";
import { scoreJob, RECENCY_MAX } from "@/lib/scoring/score";
import type { ApplyRoute } from "@/lib/apply/types";

// --- Serializable view models ------------------------------------------------
// All fields are plain JS types (string | number | boolean | null | array of
// plain objects) so they can be safely passed as server→client props without
// serialisation errors.

/**
 * Ranked-queue row shown in the UI. Every field is plain-serializable -
 * postedAt is an ISO string so Date objects never cross the server→client
 * boundary.
 */
export interface JobView {
  /** identityHash - stable canonical key, safe to use as React key. */
  id: string;
  title: string;
  company: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  source: string;
  url: string | null;
  score: number;
  relevance: number;
  reachability: number;
  relevanceDriver: "resume" | "goals" | "both";
  hardGatePass: boolean;
  /** Hard-requirement caps that fired (empty when gate passed). */
  caps: { requirement: string; reason: string }[];
  /** Plain-language explanation notes from scoring. */
  notes: string[];
  recencyBonus: number;
  /** True when recencyBonus === RECENCY_MAX (seen within the last 24 hours). */
  fresh: boolean;
  /** ISO string, or null when source didn't report a posting date. */
  postedAt: string | null;
  /** Full JD text for ATS keyword match (may be empty in preview). */
  description: string | null;
  /** Read-only apply route preview from surface metadata. */
  routePreview: ApplyRoute;
}

/**
 * Filtered-out audit-trail row. Shown in the "why was this removed" section
 * so users can verify the screen is doing the right thing.
 */
export interface FilteredView {
  title: string;
  company: string;
  source: string;
  reason: "duplicate" | "ghost" | "scam";
  /** Human-readable reasons that fired the filter (empty for dedupes). */
  reasons: string[];
}

// --- View-model helper --------------------------------------------------------

/** Map a (screened, scored) pair to the UI's JobView. */
export function jobViewFromScored(
  screened: ScreenedJob,
  scored: ScoredJob,
): JobView {
  return {
    id: screened.identityHash,
    title: screened.raw.title,
    company: screened.raw.company,
    location: screened.raw.location ?? null,
    remote: screened.raw.remote ?? false,
    salaryMin: screened.raw.salaryMin ?? null,
    salaryMax: screened.raw.salaryMax ?? null,
    source: screened.raw.source,
    url: screened.raw.url ?? null,
    score: scored.score,
    relevance: scored.relevance,
    reachability: scored.reachability,
    relevanceDriver: scored.relevanceDriver,
    hardGatePass: scored.hardGatePass,
    caps: scored.explain.caps,
    notes: scored.explain.notes,
    recencyBonus: scored.explain.recencyBonus,
    fresh: scored.explain.recencyBonus === RECENCY_MAX,
    postedAt: screened.raw.postedAt?.toISOString() ?? null,
    description: screened.raw.description ?? null,
    routePreview: previewRouteFromJob({
      source: screened.raw.source,
      url: screened.raw.url ?? null,
      atsType: screened.raw.atsType ?? null,
    }),
  };
}

// --- Pipeline -----------------------------------------------------------------

/**
 * Run the full pure pipeline over raw job postings.
 *
 * Steps:
 *   1. screen(rawJobs)        - dedupe + ghost + scam filter
 *   2. scoreJob(each kept)    - relevance × reachability × hard-gate × recency
 *   3. sort by score DESC     - best matches first
 *   4. map to view models     - serializable shapes for the UI
 *
 * `firstSeenAt` defaults to `() => now` so every job is treated as freshly
 * discovered - correct for the offline preview and deterministic tests. In
 * production, the service layer passes the actual DB firstSeenAt for each
 * identity hash so recency is anchored to the first time we ever saw the post.
 */
export function runPipeline(input: {
  rawJobs: RawJob[];
  resumeText: string;
  goalText: string;
  profileText: string;
  hardFacts: HardFacts;
  now: Date;
  /** Optional per-job firstSeenAt override. Defaults to () => now. */
  firstSeenAt?: (raw: RawJob) => Date;
}): {
  ranked: { screened: ScreenedJob; scored: ScoredJob }[];
  queue: JobView[];
  filtered: FilteredView[];
  stats: ScreenResult["stats"];
} {
  const { rawJobs, resumeText, goalText, profileText, hardFacts, now } = input;
  const getFirstSeenAt = input.firstSeenAt ?? (() => now);

  // -- 1. Screen --------------------------------------------------------------
  const result = screen(rawJobs);

  // -- 2. Score each kept posting --------------------------------------------
  const scoredKept: { screened: ScreenedJob; scored: ScoredJob }[] =
    result.kept.map((screened) => ({
      screened,
      scored: scoreJob({
        jobText: `${screened.raw.title}. ${screened.raw.description}`,
        resumeText,
        goalText,
        profileText,
        hardFacts,
        firstSeenAt: getFirstSeenAt(screened.raw),
        now,
      }),
    }));

  // -- 3. Sort by score DESC -------------------------------------------------
  const ranked = [...scoredKept].sort(
    (a, b) => b.scored.score - a.scored.score,
  );

  // -- 4. Map to view models -------------------------------------------------
  const queue: JobView[] = ranked.map(({ screened, scored }) =>
    jobViewFromScored(screened, scored),
  );

  const filtered: FilteredView[] = result.dropped.map((screened) => {
    const reason = (screened.excludeReason ?? "duplicate") as
      | "duplicate"
      | "ghost"
      | "scam";
    const reasons =
      reason === "ghost"
        ? screened.ghost.reasons
        : reason === "scam"
          ? screened.scam.reasons
          : [];
    return {
      title: screened.raw.title,
      company: screened.raw.company,
      source: screened.raw.source,
      reason,
      reasons,
    };
  });

  return { ranked, queue, filtered, stats: result.stats };
}
