/**
 * Job-engine data service - the ONLY file in the job engine that imports
 * @/lib/db. All Prisma reads and writes live here; pure scoring logic lives in
 * pipeline.ts and the brain modules.
 *
 * Three surfaces:
 *   ingestAndScore  - live ingest: discover → screen → score → upsert
 *   listQueue       - read non-excluded jobs, sorted by score desc
 *   listFiltered    - read excluded audit trail
 *   previewQueue    - offline preview over fixture jobs (no DB, no network)
 */
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { discover } from "@/lib/jobs/sources";
import { screen } from "@/lib/jobs/filter";
import { scoreJobAsync, RECENCY_MAX } from "@/lib/scoring/score";
import { nonSensitiveProfileText, getGoal } from "@/lib/goals/service";
import { goalText as goalTextFrom } from "@/lib/goals/types";
import { deriveHardFacts } from "@/lib/jobs/hard-facts";
import { runPipeline, jobViewFromScored } from "@/lib/jobs/pipeline";
import { previewRouteFromJob } from "@/lib/pipeline/route-preview";
import { fixtureJobs } from "@/lib/jobs/sources/fixtures";
import type { JobView, FilteredView } from "@/lib/jobs/pipeline";
import type { ScoreExplain, ScreenResult } from "@/lib/jobs/types";

// Silence the unused-import lint - jobViewFromScored is re-exported below
// for callers who want to convert a (screened, scored) pair without going
// through the full pipeline.
export { jobViewFromScored };

// -- ingestAndScore ------------------------------------------------------------

/**
 * Discover → screen → score → upsert. The live ingest path called by the
 * server action.
 *
 * firstSeenAt preservation: the DB column has @default(now()) and is intentionally
 * absent from the `update` payload. On the first insert the DB sets it; on every
 * subsequent update it is left untouched. Recency is therefore always anchored to
 * the first time WE saw the posting, not the source's claimed date (which is
 * untrusted and never a score multiplier - plan §8b).
 */
export async function ingestAndScore(
  scope: AppScope,
  query: string,
): Promise<{ ingested: number; kept: number; filtered: number }> {
  const now = new Date();

  const [resumeText, goal] = await Promise.all([
    nonSensitiveProfileText(scope),
    getGoal(scope),
  ]);
  const gt = goal ? goalTextFrom(goal) : "";
  const hardFacts = deriveHardFacts(resumeText);

  // -- Discover + screen -----------------------------------------------------
  const rawJobs = await discover(query);
  const { kept, dropped } = screen(rawJobs);

  // -- Pre-fetch existing firstSeenAt for kept jobs --------------------------
  // Jobs already in the DB keep their original firstSeenAt; new jobs use `now`
  // (matching what the DB default will write on creation).
  const keptHashes = kept.map((s) => s.identityHash);
  const existing = await db.job.findMany({
    where: { ...scopeWhere(scope), identityHash: { in: keptHashes } },
    select: { identityHash: true, firstSeenAt: true },
  });
  const firstSeenMap = new Map(existing.map((j) => [j.identityHash, j.firstSeenAt]));

  // -- Score and upsert kept jobs --------------------------------------------
  for (const screened of kept) {
    const firstSeenAt = firstSeenMap.get(screened.identityHash) ?? now;
    const jobText = `${screened.raw.title}. ${screened.raw.description}`;
    const scored = await scoreJobAsync(scope, {
      jobText,
      resumeText,
      goalText: gt,
      profileText: resumeText,
      hardFacts,
      firstSeenAt,
      now,
    });

    const flags = {
      ghostReasons: screened.ghost.reasons,
      scamReasons: screened.scam.reasons,
    } as unknown as Prisma.InputJsonValue;

    const explainJson = scored.explain as unknown as Prisma.InputJsonValue;

    // Fields shared between create and update. firstSeenAt is intentionally
    // absent - the DB default handles create; update leaves it untouched.
    const sharedFields = {
      fingerprint: screened.fingerprint,
      source: screened.raw.source,
      url: screened.raw.url ?? null,
      company: screened.raw.company,
      title: screened.raw.title,
      location: screened.raw.location ?? null,
      remote: screened.raw.remote ?? false,
      description: screened.raw.description,
      atsType: screened.raw.atsType ?? null,
      salaryMin: screened.raw.salaryMin ?? null,
      salaryMax: screened.raw.salaryMax ?? null,
      postedAt: screened.raw.postedAt ?? null,
      excluded: false,
      excludeReason: null,
      ghostScore: screened.ghost.score,
      scamScore: screened.scam.score,
      flags,
      score: scored.score,
      relevance: scored.relevance,
      reachability: scored.reachability,
      relevanceDriver: scored.relevanceDriver,
      hardGatePass: scored.hardGatePass,
      scoreExplain: explainJson,
    };

    await db.job.upsert({
      where: {
        profileId_identityHash: {
          profileId: scope.profileId,
          identityHash: screened.identityHash,
        },
      },
      create: {
        ...scopeData(scope),
        identityHash: screened.identityHash,
        ...sharedFields,
      },
      update: sharedFields,
    });
  }

  // -- Upsert dropped jobs (audit trail) ------------------------------------
  for (const screened of dropped) {
    const reason = screened.excludeReason ?? "duplicate";
    const flags = {
      ghostReasons: screened.ghost.reasons,
      scamReasons: screened.scam.reasons,
    } as unknown as Prisma.InputJsonValue;

    const droppedCreate = {
      ...scopeData(scope),
      identityHash: screened.identityHash,
      fingerprint: screened.fingerprint,
      source: screened.raw.source,
      url: screened.raw.url ?? null,
      company: screened.raw.company,
      title: screened.raw.title,
      location: screened.raw.location ?? null,
      remote: screened.raw.remote ?? false,
      description: screened.raw.description,
      atsType: screened.raw.atsType ?? null,
      salaryMin: screened.raw.salaryMin ?? null,
      salaryMax: screened.raw.salaryMax ?? null,
      postedAt: screened.raw.postedAt ?? null,
      excluded: true,
      excludeReason: reason,
      ghostScore: screened.ghost.score,
      scamScore: screened.scam.score,
      flags,
    };

    const droppedUpdate = {
      fingerprint: screened.fingerprint,
      source: screened.raw.source,
      url: screened.raw.url ?? null,
      excluded: true,
      excludeReason: reason,
      ghostScore: screened.ghost.score,
      scamScore: screened.scam.score,
      flags,
    };

    await db.job.upsert({
      where: {
        profileId_identityHash: {
          profileId: scope.profileId,
          identityHash: screened.identityHash,
        },
      },
      create: droppedCreate,
      update: droppedUpdate,
    });
  }

  return {
    ingested: rawJobs.length,
    kept: kept.length,
    filtered: dropped.length,
  };
}

// -- listQueue -----------------------------------------------------------------

/** Read the ranked job queue from the DB, ordered by score desc (nulls last). */
export async function listQueue(scope: AppScope): Promise<JobView[]> {
  const now = new Date();
  const jobs = await db.job.findMany({
    where: { ...scopeWhere(scope), excluded: false },
    orderBy: [{ score: "desc" }, { firstSeenAt: "desc" }],
  });

  return jobs.map((j) => {
    const explain = j.scoreExplain as unknown as ScoreExplain | null;
    // Recompute fresh from firstSeenAt so it stays accurate over time, not
    // frozen at the moment of scoring.
    const fresh =
      j.firstSeenAt != null
        ? now.getTime() - j.firstSeenAt.getTime() < 24 * 60 * 60 * 1000
        : false;

    return {
      id: j.identityHash,
      title: j.title,
      company: j.company,
      location: j.location ?? null,
      remote: j.remote,
      salaryMin: j.salaryMin ?? null,
      salaryMax: j.salaryMax ?? null,
      source: j.source,
      url: j.url ?? null,
      score: j.score ?? 0,
      relevance: j.relevance ?? 0,
      reachability: j.reachability ?? 0,
      relevanceDriver: (j.relevanceDriver ?? "both") as
        | "resume"
        | "goals"
        | "both",
      hardGatePass: j.hardGatePass ?? true,
      caps: explain?.caps ?? [],
      notes: explain?.notes ?? [],
      recencyBonus: explain?.recencyBonus ?? 0,
      fresh,
      postedAt: j.postedAt?.toISOString() ?? null,
      description: j.description ?? null,
      routePreview: previewRouteFromJob({
        source: j.source,
        url: j.url,
        atsType: j.atsType,
      }),
    };
  });
}

// -- listFiltered --------------------------------------------------------------

/** Read the filtered-out audit trail from the DB. */
export async function listFiltered(scope: AppScope): Promise<FilteredView[]> {
  const jobs = await db.job.findMany({
    where: { ...scopeWhere(scope), excluded: true },
    orderBy: { firstSeenAt: "desc" },
  });

  return jobs.map((j) => {
    const reason = (j.excludeReason ?? "duplicate") as
      | "duplicate"
      | "ghost"
      | "scam";
    const flags = j.flags as unknown as {
      ghostReasons?: string[];
      scamReasons?: string[];
    } | null;
    const reasons =
      reason === "ghost"
        ? (flags?.ghostReasons ?? [])
        : reason === "scam"
          ? (flags?.scamReasons ?? [])
          : [];

    return {
      title: j.title,
      company: j.company,
      source: j.source,
      reason,
      reasons,
    };
  });
}

// -- previewQueue --------------------------------------------------------------

/**
 * Offline preview using fixture jobs. No DB, no network.
 * Used when Postgres isn't reachable or the live queue is empty on first visit.
 */
export function previewQueue(input: {
  resumeText: string;
  goalText: string;
  profileText: string;
  now: Date;
}): {
  queue: JobView[];
  filtered: FilteredView[];
  stats: ScreenResult["stats"];
} {
  const hardFacts = deriveHardFacts(input.profileText);
  const { queue, filtered, stats } = runPipeline({
    rawJobs: fixtureJobs,
    resumeText: input.resumeText,
    goalText: input.goalText,
    profileText: input.profileText,
    hardFacts,
    now: input.now,
  });
  return { queue, filtered, stats };
}
