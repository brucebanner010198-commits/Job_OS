/**
 * Outcome-KPI SERVICE (Phase 9) - the ONLY file in this module that imports
 * @/lib/db. It flattens the user's real pipeline rows into the DB-decoupled
 * MetricsInput and hands them to the pure compute brain. No KPI math lives here;
 * the brain owns it, so it stays unit-testable.
 *
 * Lane attribution (the barbell): an application is "warm" when the user actually
 * went through the warm-path for that company - i.e. a referral intro was SENT -
 * or the application sits in the WARM_PATH column. Everything else is "cold".
 *
 * getMetricsView NEVER THROWS: any read failure degrades to the deterministic
 * offline preview so the dashboard always renders.
 */
import { db } from "@/lib/db";
import { processMetrics, previewMetrics } from "@/lib/metrics/pipeline";
import type {
  ApplicationRecord,
  AppStatusKey,
  InterviewRecord,
  LaneKey,
  MetricsInput,
  MetricsView,
} from "@/lib/metrics/types";
import type { AppScope } from "@/lib/profiles/types";
import { scopeWhere } from "@/lib/profiles/scope";

/** Statuses that count as a submitted application (mirrors the brain's set). */
const SUBMITTED: ReadonlySet<string> = new Set([
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
]);

/** Pull a numeric `overall` out of a stored SessionScore JSON, when present. */
function scoreOverall(score: unknown): number | undefined {
  if (score && typeof score === "object" && "overall" in score) {
    const o = (score as { overall?: unknown }).overall;
    if (typeof o === "number" && Number.isFinite(o)) return o;
  }
  return undefined;
}

/**
 * Build the MetricsInput for a user from the DB. Reads applications (+ the job's
 * firstSeenAt for the speed clock), the companies the user sent a warm intro to
 * (lane attribution), and the interview sessions (mock-practice stat).
 */
async function loadInput(scope: AppScope): Promise<MetricsInput> {
  const [apps, sentIntros, sessions] = await Promise.all([
    db.application.findMany({
      where: scopeWhere(scope),
      include: { job: true },
    }),
    db.warmIntro.findMany({
      where: { ...scopeWhere(scope), state: "SENT" },
      select: { company: true },
    }),
    db.interviewSession.findMany({
      where: scopeWhere(scope),
      select: { id: true, mode: true, score: true, createdAt: true },
    }),
  ]);

  const warmCompanies = new Set(sentIntros.map((i) => i.company));

  const applications: ApplicationRecord[] = apps.map((app) => {
    const status = app.status as AppStatusKey;
    const lane: LaneKey =
      status === "WARM_PATH" || warmCompanies.has(app.job.company)
        ? "warm"
        : "cold";
    // submittedAt: the explicit apply timestamp if we have one, else - for an
    // application already past submission - fall back to its last-updated stamp.
    const submittedAt =
      app.submittedAt?.toISOString() ??
      (SUBMITTED.has(status) ? app.updatedAt.toISOString() : undefined);

    return {
      id: app.id,
      company: app.job.company,
      status,
      lane,
      firstSeenAt: app.job.firstSeenAt?.toISOString(),
      submittedAt,
      createdAt: app.createdAt.toISOString(),
    };
  });

  const interviews: InterviewRecord[] = sessions.map((s) => ({
    id: s.id,
    mode: s.mode as string,
    overall: scoreOverall(s.score),
    createdAt: s.createdAt.toISOString(),
  }));

  return { applications, interviews };
}

/**
 * The live outcome dashboard. Computes from the user's real pipeline as of now;
 * falls back to the offline preview on any read failure so the page never blanks.
 */
export async function getMetricsView(scope: AppScope): Promise<MetricsView> {
  try {
    const input = await loadInput(scope);
    return processMetrics(input, new Date().toISOString());
  } catch {
    return previewMetrics();
  }
}

export { previewMetrics } from "@/lib/metrics/pipeline";
