/**
 * Catch-up PLANNER (Phase 9, plan §9). Pure - no DB, no clock reads: the caller
 * injects `nowIso`. This is the watermark-idempotency core: it decides which
 * recurring jobs are DUE from each job's last-run time, so a job missed while the
 * laptop slept becomes due on the next wake, runs once, advances its watermark,
 * and is NOT due again until its interval elapses. Running the planner twice in a
 * row with the same now yields the same plan; running a job flips it to not-due.
 */
import type {
  JobKind,
  RunDecision,
  RunPlan,
  RunReceipt,
  RunStatus,
  ScheduledJob,
} from "@/lib/scheduler/types";
import { JOB_SPECS, JOB_SPEC_BY_KIND } from "@/lib/scheduler/types";

/** A persisted watermark row, narrowed to what the merge needs. */
export interface RunWatermark {
  kind: JobKind;
  lastRunAt?: string;
  lastStatus?: RunStatus;
  lastDetail?: string;
  runs?: number;
}

/**
 * Merge the static job catalog with any persisted watermarks, so EVERY known job
 * appears (a never-run job shows up with no lastRunAt). Unknown kinds in the
 * watermark set are ignored - the catalog is the source of truth for what exists.
 */
export function jobsFromWatermarks(
  watermarks: RunWatermark[],
  overrides?: Partial<Record<JobKind, { intervalSec?: number }>>,
): ScheduledJob[] {
  const byKind = new Map(watermarks.map((w) => [w.kind, w] as const));
  return JOB_SPECS.map((spec) => {
    const w = byKind.get(spec.kind);
    return {
      kind: spec.kind,
      label: spec.label,
      intervalSec: overrides?.[spec.kind]?.intervalSec ?? spec.defaultIntervalSec,
      lastRunAt: w?.lastRunAt,
      lastStatus: w?.lastStatus,
      lastDetail: w?.lastDetail,
      runs: w?.runs ?? 0,
    };
  });
}

/** Compact human duration: "45s", "12m", "3h", "2d" (largest sensible unit). */
export function humanizeDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

/** Decide a single job's run status as of `nowIso`. */
function decide(job: ScheduledJob, nowMs: number): RunDecision {
  if (!job.lastRunAt) {
    return { kind: job.kind, due: true, reason: "Not yet run", overdueSec: 0 };
  }
  const lastMs = Date.parse(job.lastRunAt);
  if (!Number.isFinite(lastMs)) {
    // Garbled watermark → treat as never run (fail safe = run it).
    return {
      kind: job.kind,
      due: true,
      reason: "Last run invalid. Scheduled now.",
      overdueSec: 0,
      lastRunAt: job.lastRunAt,
    };
  }

  const ageSec = (nowMs - lastMs) / 1000;
  const overdueSec = ageSec - job.intervalSec;

  if (overdueSec >= 0) {
    return {
      kind: job.kind,
      due: true,
      reason:
        overdueSec < 1
          ? "Scheduled to run"
          : `Overdue by ${humanizeDuration(overdueSec)}`,
      overdueSec,
      lastRunAt: job.lastRunAt,
    };
  }

  return {
    kind: job.kind,
    due: false,
    reason: `Last run ${humanizeDuration(ageSec)} ago. Next in ${humanizeDuration(-overdueSec)}`,
    overdueSec: 0,
    lastRunAt: job.lastRunAt,
  };
}

/**
 * Plan a wake-up: decide every job, and collect the due subset. The runner runs
 * only `dueKinds`, then advances each watermark via nextRunState so the same wake
 * never runs a job twice.
 */
export function planRun(jobs: ScheduledJob[], nowIso: string): RunPlan {
  const nowMs = Date.parse(nowIso);
  const decisions = jobs.map((j) => decide(j, nowMs));
  const dueKinds = decisions.filter((d) => d.due).map((d) => d.kind);
  return { nowIso, decisions, dueKinds };
}

/**
 * Advance a job's watermark after a run. lastRunAt moves to the receipt's instant,
 * runs increments, and the status/detail are recorded. This is what makes a just-
 * run job no longer due on the next plan.
 */
export function nextRunState(job: ScheduledJob, receipt: RunReceipt): ScheduledJob {
  return {
    ...job,
    lastRunAt: receipt.ranAtIso,
    lastStatus: receipt.status,
    lastDetail: receipt.detail,
    runs: job.runs + 1,
  };
}

/** Convenience: the spec label for a kind (kept here so the UI can avoid imports). */
export function labelFor(kind: JobKind): string {
  return JOB_SPEC_BY_KIND[kind].label;
}
