/**
 * Outcome-KPI compute BRAIN (Phase 9, plan §9). Pure - no DB, no LLM, no network,
 * no wall-clock reads. The caller injects `nowIso`; everything else is derived
 * from the passed-in pipeline rows, so the whole thing is deterministic and
 * unit-testable.
 *
 * What it answers (the operating KPI, not vanity activity):
 *   - interviews per 10 SUBMITTED applications (headline) + offer rate,
 *   - the same split by LANE (cold vs warm) with a verdict that flags a lane
 *     that isn't converting,
 *   - speed-to-apply (median hours from first-seen to submitted - the ~8× lever),
 *   - a prioritised, plain-English "what to do next" list.
 *
 * It never invents a number: every figure traces to the input rows.
 */
import type {
  ApplicationRecord,
  FunnelCounts,
  KpiHeadline,
  LaneKey,
  LaneMetrics,
  MetricsInput,
  MetricsView,
  SpeedMetrics,
  SpeedVerdict,
  Verdict,
} from "@/lib/metrics/types";
import {
  LANE_HEALTHY_PER10,
  LANE_LABEL,
  MIN_APPS_FOR_VERDICT,
  SPEED_FAST_HOURS,
  SPEED_OK_HOURS,
} from "@/lib/metrics/types";

const HOUR_MS = 60 * 60 * 1000;

/** A submitted application is one that reached APPLIED or any later stage. */
const SUBMITTED: ReadonlySet<string> = new Set([
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
]);

/** Reaching the interview stage - an OFFER implies the interview happened. */
function reachedInterview(status: string): boolean {
  return status === "INTERVIEWING" || status === "OFFER";
}

/** Round to one decimal place (stable, deterministic). */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** x per 10 of base, rounded to one decimal; 0 when base is 0. */
function per10(x: number, base: number): number {
  return base > 0 ? round1((x / base) * 10) : 0;
}

/** Median of a numeric list (sorted copy); undefined for an empty list. */
function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// --- funnel ------------------------------------------------------------------

function countFunnel(apps: ApplicationRecord[]): FunnelCounts {
  let pipeline = 0;
  let applied = 0;
  let interviewing = 0;
  let offer = 0;
  let rejected = 0;

  for (const a of apps) {
    if (a.status === "WARM_PATH" || a.status === "TO_APPLY") pipeline++;
    if (SUBMITTED.has(a.status)) applied++;
    if (reachedInterview(a.status)) interviewing++;
    if (a.status === "OFFER") offer++;
    if (a.status === "REJECTED") rejected++;
    // SKIPPED counts toward nothing.
  }

  return { pipeline, applied, interviewing, offer, rejected };
}

// --- per-lane ----------------------------------------------------------------

function laneMetrics(lane: LaneKey, apps: ApplicationRecord[]): LaneMetrics {
  const submitted = apps.filter((a) => a.lane === lane && SUBMITTED.has(a.status));
  const applications = submitted.length;
  const interviews = submitted.filter((a) => reachedInterview(a.status)).length;
  const offers = submitted.filter((a) => a.status === "OFFER").length;
  const rejections = submitted.filter((a) => a.status === "REJECTED").length;

  const interviewsPer10Apps = per10(interviews, applications);
  const offersPer10Apps = per10(offers, applications);
  const healthy = LANE_HEALTHY_PER10[lane];

  let verdict: Verdict;
  let recommendation: string | undefined;

  if (applications < MIN_APPS_FOR_VERDICT) {
    verdict = "insufficient-data";
    recommendation =
      applications === 0
        ? `No ${LANE_LABEL[lane].toLowerCase()} applications submitted yet.`
        : `Only ${applications} submitted - apply to at least ${MIN_APPS_FOR_VERDICT} ` +
          `to read this lane's conversion reliably.`;
  } else if (interviewsPer10Apps >= healthy) {
    verdict = "converting";
  } else {
    verdict = "underperforming";
    recommendation =
      lane === "cold"
        ? `Cold applications are converting below target ` +
          `(${interviewsPer10Apps}/10 vs ~${healthy}/10). Referrals convert ` +
          `~7–10× better - shift effort to the warm-path lane.`
        : `Warm intros aren't converting (${interviewsPer10Apps}/10 vs ` +
          `~${healthy}/10). Make each referral ask more specific and personal, ` +
          `and follow up. A weak warm lane wastes your most effective channel.`;
  }

  return {
    lane,
    applications,
    interviews,
    offers,
    rejections,
    interviewsPer10Apps,
    offersPer10Apps,
    verdict,
    recommendation,
  };
}

// --- speed-to-apply ----------------------------------------------------------

function speedMetrics(apps: ApplicationRecord[]): SpeedMetrics {
  const hours: number[] = [];
  for (const a of apps) {
    if (!a.firstSeenAt || !a.submittedAt) continue;
    const seen = Date.parse(a.firstSeenAt);
    const sent = Date.parse(a.submittedAt);
    if (!Number.isFinite(seen) || !Number.isFinite(sent)) continue;
    if (sent < seen) continue; // ignore impossible/garbled ordering
    hours.push((sent - seen) / HOUR_MS);
  }

  const sampleSize = hours.length;
  const med = median(hours);
  const medianHours = med === undefined ? undefined : round1(med);

  let verdict: SpeedVerdict;
  if (sampleSize < 3 || medianHours === undefined) {
    verdict = "insufficient-data";
  } else if (medianHours <= SPEED_FAST_HOURS) {
    verdict = "fast";
  } else if (medianHours <= SPEED_OK_HOURS) {
    verdict = "ok";
  } else {
    verdict = "slow";
  }

  return { sampleSize, medianHours, verdict };
}

// --- recommendations (the lead list) -----------------------------------------

function buildRecommendations(
  funnel: FunnelCounts,
  lanes: LaneMetrics[],
  speed: SpeedMetrics,
): string[] {
  const recs: string[] = [];
  const cold = lanes.find((l) => l.lane === "cold")!;
  const warm = lanes.find((l) => l.lane === "warm")!;

  // Highest priority: an offer in hand.
  if (funnel.offer > 0) {
    recs.push(
      `🎉 You have ${funnel.offer} offer${funnel.offer === 1 ? "" : "s"} in hand - ` +
        `open the salary coach before you respond. Most people who negotiate ` +
        `gain ~+18–20%.`,
    );
  }

  // No submissions at all - point at the top of the funnel.
  if (funnel.applied === 0) {
    recs.push(
      `No applications submitted yet. Discover roles in the Job Engine, then ` +
        `apply - speed matters most in the first 24–48h.`,
    );
    return recs;
  }

  // Too little data to judge conversion.
  if (funnel.applied < MIN_APPS_FOR_VERDICT) {
    recs.push(
      `Only ${funnel.applied} application${funnel.applied === 1 ? "" : "s"} ` +
        `submitted - apply to a few more to get a reliable read on conversion.`,
    );
  }

  // Lane verdicts → concrete shifts.
  if (cold.verdict === "underperforming") {
    if (warm.applications === 0) {
      recs.push(
        `Cold applications are converting below target and you haven't used ` +
          `the warm-path lane yet. Find a referral before applying cold - ` +
          `referrals convert ~7–10× better.`,
      );
    } else if (cold.recommendation) {
      recs.push(cold.recommendation);
    }
  }
  if (warm.verdict === "underperforming" && warm.recommendation) {
    recs.push(warm.recommendation);
  }

  // Speed lever.
  if (speed.verdict === "slow" && speed.medianHours !== undefined) {
    recs.push(
      `You're applying a median of ${speed.medianHours}h after a job appears. ` +
        `Applying within 24–48h is up to ~8× more likely to get an interview - ` +
        `prioritise fresh (<24h) matches.`,
    );
  }

  // All clear - reinforce, don't nag.
  if (recs.length === 0) {
    const healthyWarm = warm.verdict === "converting";
    recs.push(
      healthyWarm
        ? `Conversion looks healthy in both lanes - keep the volume steady and ` +
            `keep the warm lane active.`
        : `Cold conversion looks healthy. Add warm-path intros where you can. ` +
            `Referrals are still your most effective channel.`,
    );
  }

  return recs;
}

// --- the brain ---------------------------------------------------------------

/**
 * Compute the full outcome-KPI view from the user's pipeline rows, as of `nowIso`.
 * Deterministic: the same input always yields the same view.
 */
export function computeKpis(input: MetricsInput, nowIso: string): MetricsView {
  const { applications, interviews } = input;

  const funnel = countFunnel(applications);
  const lanes: LaneMetrics[] = [
    laneMetrics("cold", applications),
    laneMetrics("warm", applications),
  ];
  const speed = speedMetrics(applications);

  const headline: KpiHeadline = {
    totalApplications: funnel.applied,
    totalInterviews: funnel.interviewing,
    totalOffers: funnel.offer,
    interviewsPer10Apps: per10(funnel.interviewing, funnel.applied),
    offerRate: funnel.applied > 0 ? funnel.offer / funnel.applied : 0,
    interviewRate: funnel.applied > 0 ? funnel.interviewing / funnel.applied : 0,
  };

  const liveSessions = interviews.filter((i) => i.mode !== "STUDY").length;
  const scored = interviews
    .map((i) => i.overall)
    .filter((s): s is number => typeof s === "number");
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
      : undefined;

  return {
    headline,
    funnel,
    lanes,
    speed,
    practice: {
      sessions: interviews.length,
      liveSessions,
      avgScore,
    },
    recommendations: buildRecommendations(funnel, lanes, speed),
    generatedAt: nowIso,
  };
}
