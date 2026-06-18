/**
 * Outcome-KPI contract (Phase 9, plan §9 + operating principle #4: "Measure
 * outcomes, not activity"). Prisma-free shapes shared by the pure compute brain
 * (lib/metrics/compute.ts), the offline preview (pipeline.ts), the DB service
 * (service.ts) and the dashboard UI (components/outcomes/*).
 *
 * The headline number is INTERVIEWS PER 10 APPLICATIONS (and offers) - never
 * "applications per day". The dashboard splits the funnel by LANE (the barbell:
 * a thin cold lane vs. the warm/referral lane) and flags a lane that isn't
 * converting, because the whole strategy is to shift effort toward what actually
 * lands jobs. Every figure is derived from the user's real pipeline rows; nothing
 * is invented.
 */

// --- Lanes (the barbell) -----------------------------------------------------

/**
 * The two job-search lanes we measure separately:
 *   - "cold": a normal application with no referral path taken.
 *   - "warm": the user went through the warm-path (a referral/intro was sent for
 *     that company). Referrals convert ~7–10× better, so we hold this lane to a
 *     higher bar and surface when it underperforms.
 */
export type LaneKey = "cold" | "warm";

export const LANE_LABEL: Record<LaneKey, string> = {
  cold: "Cold apply",
  warm: "Warm-path",
};

// --- DB-decoupled input rows -------------------------------------------------

/** The application statuses we recognise (mirrors Prisma ApplicationStatus). */
export type AppStatusKey =
  | "WARM_PATH"
  | "TO_APPLY"
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "SKIPPED";

/**
 * One application, flattened from the DB for the compute brain. `lane` is decided
 * by the service (warm iff a referral was actually sent for the company). The
 * time fields drive the speed-to-apply metric and are optional because a
 * not-yet-submitted row has neither.
 */
export interface ApplicationRecord {
  id: string;
  company: string;
  status: AppStatusKey;
  lane: LaneKey;
  /** When the job first appeared in our DB (the speed-to-apply clock starts here). */
  firstSeenAt?: string;
  /** When the application was actually submitted (clock stops here). */
  submittedAt?: string;
  createdAt: string;
}

/** One interview session the user actually ran (mock practice - a secondary stat). */
export interface InterviewRecord {
  id: string;
  /** "STUDY" | "AI_SCREEN" | "REAL_HR" */
  mode: string;
  /** Overall score 0–100 when the session was completed + scored. */
  overall?: number;
  createdAt: string;
}

export interface MetricsInput {
  applications: ApplicationRecord[];
  interviews: InterviewRecord[];
}

// --- Funnel + verdicts -------------------------------------------------------

/**
 * The outcome funnel. `applied` is the denominator for the headline KPI: it
 * counts applications that were actually SUBMITTED (APPLIED and every stage
 * beyond it, including the terminal REJECTED). TO_APPLY / WARM_PATH / SKIPPED are
 * not yet submissions and never count toward conversion.
 */
export interface FunnelCounts {
  /** Discovered/queued but not yet submitted (WARM_PATH + TO_APPLY). */
  pipeline: number;
  /** Submitted applications (APPLIED, INTERVIEWING, OFFER, REJECTED). */
  applied: number;
  /** Reached the interview stage (INTERVIEWING or OFFER - an offer implies it). */
  interviewing: number;
  /** Reached an offer (OFFER). */
  offer: number;
  /** Terminal rejections (REJECTED). */
  rejected: number;
}

export type Verdict = "converting" | "underperforming" | "insufficient-data";

export const VERDICT_LABEL: Record<Verdict, string> = {
  converting: "Converting",
  underperforming: "Underperforming",
  "insufficient-data": "Not enough data",
};

/**
 * Per-lane conversion. `interviewsPer10Apps` is the headline KPI for the lane:
 * (apps that reached interview / submitted apps) × 10. `verdict` compares it
 * against the lane's healthy bar (LANE_HEALTHY_PER10) once there are at least
 * MIN_APPS_FOR_VERDICT submitted apps; below that it is "insufficient-data".
 */
export interface LaneMetrics {
  lane: LaneKey;
  /** Submitted applications in this lane (the denominator). */
  applications: number;
  interviews: number;
  offers: number;
  rejections: number;
  interviewsPer10Apps: number;
  offersPer10Apps: number;
  verdict: Verdict;
  /** A plain-English recommendation when the lane underperforms or lacks data. */
  recommendation?: string;
}

// --- Speed-to-apply ----------------------------------------------------------

export type SpeedVerdict = "fast" | "ok" | "slow" | "insufficient-data";

export const SPEED_VERDICT_LABEL: Record<SpeedVerdict, string> = {
  fast: "Fast",
  ok: "On pace",
  slow: "Too slow",
  "insufficient-data": "Not enough data",
};

/**
 * Speed-to-apply: how long after a job first appears the user submits. Applying
 * within 24–48h is up to ~8× more likely to get an interview, so this is a
 * first-class KPI, not a footnote. Median over submitted apps that have both a
 * first-seen and a submitted timestamp.
 */
export interface SpeedMetrics {
  /** Apps with both timestamps (the sample the median is computed over). */
  sampleSize: number;
  medianHours?: number;
  verdict: SpeedVerdict;
}

// --- Headline + the whole view -----------------------------------------------

export interface KpiHeadline {
  totalApplications: number;
  totalInterviews: number;
  totalOffers: number;
  /** The single headline figure: interviews per 10 submitted applications. */
  interviewsPer10Apps: number;
  /** Offers ÷ submitted apps, as a 0–1 rate. */
  offerRate: number;
  /** Reached-interview ÷ submitted apps, as a 0–1 rate. */
  interviewRate: number;
}

/**
 * The full dashboard view model. `practice` summarises mock-interview reps (a
 * secondary signal). `recommendations` is the actionable "what to do next" list
 * the dashboard leads with - derived purely from the numbers.
 */
export interface MetricsView {
  headline: KpiHeadline;
  funnel: FunnelCounts;
  lanes: LaneMetrics[];
  speed: SpeedMetrics;
  practice: {
    sessions: number;
    liveSessions: number;
    avgScore?: number;
  };
  recommendations: string[];
  /** ISO instant the snapshot was computed (the injected now). */
  generatedAt: string;
}

// --- Tunable thresholds (documented, not magic) ------------------------------

/** Submitted apps needed in a lane before we judge its conversion. */
export const MIN_APPS_FOR_VERDICT = 5;

/**
 * The "healthy" interviews-per-10 bar per lane. The cold lane is held to a
 * modest bar (cold applications convert poorly by nature); the warm lane is held
 * much higher because referrals are supposed to convert far better - a warm lane
 * below this bar is a real problem worth flagging.
 */
export const LANE_HEALTHY_PER10: Record<LaneKey, number> = {
  cold: 1.5,
  warm: 4.0,
};

/** Speed-to-apply thresholds (hours from first-seen to submitted). */
export const SPEED_FAST_HOURS = 24;
export const SPEED_OK_HOURS = 48;
