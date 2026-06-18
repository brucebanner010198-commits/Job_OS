/**
 * Apply-engine domain contract (Phase 5) - the single source of truth for the
 * shapes that cross module boundaries: router → knockout → field plan →
 * detection scan → idempotent state machine → driver. DB-decoupled and
 * Prisma-free so every "brain" is pure and unit-testable with no DB/network,
 * and the UI can import these types on the client.
 *
 * Safety spine (plan §8c, Hardening §A/§C):
 *   - "AI prepares, human approves" is the DEFAULT. AUTONOMOUS is rare and
 *     narrowly gated; anything ambiguous falls back to ASSISTED.
 *   - The LLM never INFERS a critical answer at submit time - values come from
 *     the user's once-confirmed ApplicationAnswers.
 *   - The apply state machine is NEVER auto-retried while SUBMITTING (prevents
 *     a crash from double-submitting).
 */

// --- Routing (lib/apply/router.ts) ----------------------------------------

/** Mirrors Prisma's AutonomyRoute enum, as string literals for Prisma-free use. */
export type ApplyRoute = "AUTONOMOUS" | "ASSISTED" | "MANUAL";

export interface RouteDecision {
  route: ApplyRoute;
  /** Plain-language reasons the route was chosen (always populated). */
  reasons: string[];
}

/** Inputs the router weighs. All optional facts default to the SAFE direction. */
export interface RouteInput {
  /** Source/ATS family, lowercased: "dice" | "wellfound" | "greenhouse" | "workday" | "linkedin" | … */
  surface: string;
  /** The prepared fill plan - used to detect critical/free-text fields. */
  fields: PreparedField[];
  /** Runtime detection scan result. */
  detection: DetectionResult;
  /** Knockout evaluation - a disqualification forces MANUAL/SKIP. */
  knockouts: KnockoutResult;
  /** True only when running locally on a residential connection (autonomy auto-disables on cloud). */
  local: boolean;
}

// --- Answers (the once-confirmed source of truth, plan §C) ----------------

/** DB-decoupled mirror of the ApplicationAnswers row. */
export interface ApplicationAnswersData {
  workAuthorized?: boolean;
  requiresSponsorship?: boolean;
  yearsExperience?: number;
  willingToRelocate?: boolean;
  remoteOnly?: boolean;
  locations: string[];
  salaryExpectation?: number;
  salaryCurrency?: string;
  noticePeriod?: string;
  hasClearance?: boolean;
  linkedinUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  /** EEO / voluntary self-id - sensitive; NEVER sent to an LLM. */
  eeo?: Record<string, string>;
  /** Remembered free-form answers. */
  customAnswers: { question: string; answer: string }[];
}

// --- Knockout (lib/apply/knockout.ts) -------------------------------------

export interface KnockoutFailure {
  /** The disqualifying requirement detected in the JD. */
  requirement: string;
  /** Why the candidate fails it, given their answers. */
  reason: string;
}

export interface KnockoutResult {
  /** True when the candidate is auto-disqualified - never waste a submit. */
  disqualified: boolean;
  failures: KnockoutFailure[];
}

// --- Field plan / itemized review gate (lib/apply/fields.ts) --------------

/** Where a field's value came from - drives the review gate's source column. */
export type FieldSource = "answers" | "profile" | "derived" | "unknown";

/**
 * One row of the itemized review gate (plan §8c): label → value → source →
 * confidence. `critical` and `freeText` and `unknown` values are exactly what
 * disqualify a job from the AUTONOMOUS lane.
 */
export interface PreparedField {
  key: string;
  label: string;
  /** The value to fill, or "" when unknown (then source==="unknown"). */
  value: string;
  source: FieldSource;
  /** 0..1 confidence the value is correct for this field. */
  confidence: number;
  /** A critical field (visa/work-auth/salary/EEO/clearance) - gates autonomy. */
  critical: boolean;
  /** A free-text/essay field - gates autonomy (can't be safely auto-filled). */
  freeText: boolean;
}

/** Critical field keys that forbid the AUTONOMOUS lane when present. */
export const CRITICAL_FIELD_KEYS: ReadonlySet<string> = new Set([
  "workAuthorization",
  "requiresSponsorship",
  "visaStatus",
  "salaryExpectation",
  "clearance",
  "eeoRace",
  "eeoGender",
  "eeoVeteran",
  "eeoDisability",
]);

// --- Runtime detection scan (lib/apply/detection.ts) ----------------------

/**
 * A page reduced to the signals the detection scan reasons over. The real
 * scanner maps a live Playwright page into this shape; tests build it directly.
 */
export interface PageSignals {
  url: string;
  host: string;
  /** Lowercased HTML / script-src markers present on the page. */
  markers: string[];
  hasLoginForm: boolean;
  hasCaptcha: boolean;
}

export interface DetectionResult {
  /** True when no CAPTCHA/login/Cloudflare/2FA signal was found. */
  clean: boolean;
  /** The specific signals that fired (empty when clean). */
  signals: string[];
}

// --- Idempotent state machine (lib/apply/state-machine.ts) ----------------

/** Mirrors Prisma's ApplyState enum. */
export type ApplyState =
  | "QUEUED"
  | "PREPARING"
  | "REVIEW"
  | "SUBMITTING"
  | "SUBMITTED"
  | "FAILED"
  | "PAUSED"
  | "HANDOFF";

/** Events that drive transitions. */
export type ApplyEvent =
  | "PREPARE"
  | "PREPARED"
  | "APPROVE"
  | "SUBMITTED_OK"
  | "SUBMITTED_FAIL"
  | "RESET"
  | "CAPTCHA_DETECTED"
  | "TAKE_CONTROL"
  | "RESUME_AI";

/**
 * The legal transition table (plan §C). The critical invariant: SUBMITTING is
 * only ever left by an explicit terminal result (SUBMITTED_OK/SUBMITTED_FAIL).
 * A process that dies in SUBMITTING must NOT auto-retry - `isAutoRetryable`
 * returns false for SUBMITTING so recovery is manual. RESET (manual retry) is
 * allowed from FAILED only, never from SUBMITTING.
 */
export const APPLY_TRANSITIONS: Readonly<
  Record<ApplyState, Partial<Record<ApplyEvent, ApplyState>>>
> = {
  QUEUED: { PREPARE: "PREPARING" },
  PREPARING: { PREPARED: "REVIEW", CAPTCHA_DETECTED: "PAUSED" },
  REVIEW: { APPROVE: "SUBMITTING", TAKE_CONTROL: "HANDOFF" },
  SUBMITTING: {
    SUBMITTED_OK: "SUBMITTED",
    SUBMITTED_FAIL: "FAILED",
    CAPTCHA_DETECTED: "PAUSED",
  },
  PAUSED: { RESUME_AI: "PREPARING", TAKE_CONTROL: "HANDOFF" },
  HANDOFF: { RESUME_AI: "PREPARING" },
  SUBMITTED: {},
  FAILED: { RESET: "QUEUED" },
};

// --- Composed plan + driver seam ------------------------------------------

/** The full apply plan for a job, composed by lib/apply/engine.ts (pure). */
export interface ApplyPlan {
  route: ApplyRoute;
  routeReasons: string[];
  knockouts: KnockoutResult;
  detection: DetectionResult;
  fields: PreparedField[];
  /** The state the application should be in after planning (REVIEW, or FAILED if disqualified). */
  nextState: ApplyState;
}

/**
 * The browser "hands" seam. The simulated adapter (offline, deterministic)
 * proves the open→scan→fill→PAUSE-at-review→submit→idempotent pipeline; the
 * real Playwright adapter is a drop-in behind this same interface and stays
 * LOCAL even after any future cloud migration (it needs your real session).
 */
export interface ApplyDriver {
  name: string;
  open(url: string): Promise<void>;
  scan(): Promise<PageSignals>;
  /** Fill text/select fields from the prepared plan. */
  fill(fields: PreparedField[]): Promise<void>;
  /** Attach a tailored resume PDF when the page exposes a file input. */
  attachResume?(pdfPath: string): Promise<boolean>;
  /** Submit. Concurrency must be 1; callers gate this behind human approval. */
  submit(): Promise<{ ok: boolean; detail?: string }>;
  /** Optional teardown (the real Playwright adapter closes the browser context).
   *  The service calls this in a finally so a real browser is never leaked. */
  close?(): Promise<void>;
}
