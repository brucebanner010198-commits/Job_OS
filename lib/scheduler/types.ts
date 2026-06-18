/**
 * Scheduler / catch-up contract (Phase 9, plan §9 + "the hard reality" #3:
 * local-first cannot mean 24/7). Prisma-free shapes shared by the pure planner
 * (plan.ts), the launchd plist generator (launchd.ts), the push-relay seam
 * (push-relay.ts), the DB service (service.ts) and the ops UI.
 *
 * The model of "background": a laptop is asleep most of the day, so a recurring
 * job means "catch up on everything since it last ran, idempotently, whenever the
 * machine is awake." A macOS launchd agent with RunAtLoad + StartInterval fires
 * the runner on wake and on a cadence; the pure planner decides what is actually
 * due from each job's last-run WATERMARK, so a job missed during sleep runs once
 * on wake and never double-runs within its interval.
 */

// --- Job catalog -------------------------------------------------------------

/** The recurring background jobs the catch-up runner knows how to run. */
export type JobKind =
  | "gmail-sync"
  | "discover-jobs"
  | "refresh-followups"
  | "refresh-career-content"
  | "autopilot-cycle";

export type RunStatus = "ok" | "failed" | "skipped";

export interface JobSpec {
  kind: JobKind;
  label: string;
  description: string;
  /** How often it should run, in seconds (the catch-up cadence). */
  defaultIntervalSec: number;
}

const MIN = 60;

function careerAgentIntervalSec(): number {
  const n = parseInt(process.env.CAREER_AGENT_INTERVAL_SEC ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 4 * 60 * MIN;
}

/**
 * The catalog. Intervals are deliberately modest - these are cheap catch-up
 * pulls, and the launchd cadence is the real wake granularity. gmail-sync is the
 * most time-sensitive (an interview invite shouldn't sit unseen); discovery and
 * follow-ups are fine a few times a day.
 */
export const JOB_SPECS: readonly JobSpec[] = [
  {
    kind: "gmail-sync",
    label: "Gmail sync",
    description:
      "Incremental, idempotent Gmail catch-up - classify new mail and PROPOSE " +
      "status changes (never auto-applies them).",
    defaultIntervalSec: 30 * MIN,
  },
  {
    kind: "discover-jobs",
    label: "Job discovery",
    description:
      "Pull fresh postings, dedupe/ghost/scam-filter, and re-score the queue " +
      "so new strong matches surface fast (speed is the edge).",
    defaultIntervalSec: 6 * 60 * MIN,
  },
  {
    kind: "refresh-followups",
    label: "Follow-up cadence",
    description:
      "Recompute post-application and post-interview nudges so due follow-ups " +
      "are ready (drafts only - never auto-sent).",
    defaultIntervalSec: 12 * 60 * MIN,
  },
  {
    kind: "refresh-career-content",
    label: "Career content refresh",
    description:
      "Polish master bullets into resume frameworks and refresh tailored " +
      "resumes + cover letters for saved targets (drafts only).",
    defaultIntervalSec: careerAgentIntervalSec(),
  },
  {
    kind: "autopilot-cycle",
    label: "Autopilot cycle",
    description:
      "Goal-aware discover → brief top jobs → prepare → auto-submit AUTONOMOUS only. " +
      "ASSISTED/MANUAL stop at REVIEW.",
    defaultIntervalSec: 12 * 60 * MIN,
  },
] as const;

export const JOB_SPEC_BY_KIND: Record<JobKind, JobSpec> = JOB_SPECS.reduce(
  (acc, s) => {
    acc[s.kind] = s;
    return acc;
  },
  {} as Record<JobKind, JobSpec>,
);

// --- A scheduled job + its run watermark -------------------------------------

/**
 * One job's current scheduling state, merged from its catalog spec and its
 * persisted run watermark. `lastRunAt` undefined means it has never run → due now.
 */
export interface ScheduledJob {
  kind: JobKind;
  label: string;
  intervalSec: number;
  lastRunAt?: string;
  lastStatus?: RunStatus;
  /** A short JSON-ish detail of the last run (counts / error) for the UI. */
  lastDetail?: string;
  runs: number;
}

/** The per-job decision the planner makes. */
export interface RunDecision {
  kind: JobKind;
  due: boolean;
  /** Plain-English reason ("never run", "overdue by 2h", "ran 10m ago"). */
  reason: string;
  /** Seconds overdue past the interval (0 when not yet due). */
  overdueSec: number;
  lastRunAt?: string;
}

/** The whole plan for one wake-up: every job's decision + the due subset. */
export interface RunPlan {
  nowIso: string;
  decisions: RunDecision[];
  dueKinds: JobKind[];
}

/** A receipt the runner produces after running a job (advances the watermark). */
export interface RunReceipt {
  kind: JobKind;
  ranAtIso: string;
  status: RunStatus;
  detail?: string;
}

// --- launchd agent -----------------------------------------------------------

export const DEFAULT_LAUNCHD_LABEL = "com.jobos.catchup";
/** Default wake cadence for the launchd agent: every 30 minutes. */
export const DEFAULT_LAUNCHD_INTERVAL_SEC = 30 * MIN;

/**
 * Everything needed to render a macOS launchd agent that runs the catch-up
 * runner. RunAtLoad makes a missed run fire as soon as the machine wakes (the
 * whole point); StartInterval keeps it ticking while awake.
 */
export interface LaunchdConfig {
  label: string;
  /** Absolute path to the node/tsx binary that runs the script. */
  programPath: string;
  /** Arguments after the program (e.g. the runner script path). */
  programArgs: string[];
  intervalSec: number;
  workingDirectory: string;
  /** Where the agent's stdout/stderr are written. */
  logPath: string;
  runAtLoad: boolean;
}

// --- optional Gmail push relay (the one always-on cloud piece) ---------------

/**
 * Status of the OPTIONAL Gmail Pub/Sub push relay. The default is polling on wake
 * (launchd); the relay is a tiny always-on cloud subscriber that pings the local
 * app for near-instant email sync. It's a documented seam, off unless configured.
 */
export interface PushRelayStatus {
  configured: boolean;
  enabled: boolean;
  provider: "none" | "gmail-pubsub";
  detail: string;
  topic?: string;
}

// --- the ops view (page model) -----------------------------------------------

export interface LaunchdView {
  label: string;
  intervalSec: number;
  /** We can't reliably detect installation; the UI shows the copy-paste setup. */
  installed: boolean;
  plistPath: string;
  plist: string;
  /** Ordered shell commands to install + load the agent. */
  install: string[];
}

export interface OpsView {
  jobs: ScheduledJob[];
  plan: RunPlan;
  launchd: LaunchdView;
  pushRelay: PushRelayStatus;
}
