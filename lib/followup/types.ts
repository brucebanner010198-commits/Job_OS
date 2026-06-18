/**
 * Follow-up cadence contract (Phase 7 booster, plan §10) - deterministic
 * post-application and post-interview nudges with drafted messages. Prisma-free
 * so the cadence brain (lib/followup/cadence.ts) is pure and unit-testable with
 * no DB/network/clock-read (the caller injects `nowIso`).
 *
 * Cadence rules (the spine):
 *   - NEVER nags: a minimum spacing before the first nudge, and at most one live
 *     nudge of a given kind per application.
 *   - STOPS on a terminal status: REJECTED produces nothing; OFFER hands off to
 *     the salary coach (no generic nudge).
 *   - DRAFT-FIRST: every nudge carries a polite, specific drafted message; the
 *     app never auto-sends - the human edits and sends.
 *   - The highest-value nudge is the post-interview THANK-YOU within ~24h.
 */

/** Mirrors the relevant subset of Prisma ApplicationStatus. */
export type FollowUpAppStatus =
  | "WARM_PATH"
  | "TO_APPLY"
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "SKIPPED";

export type FollowUpKind =
  | "APPLICATION_NUDGE" // applied, no response in N days → reiterate interest
  | "INTERVIEW_THANK_YOU" // just interviewed → thank-you within 24h
  | "POST_INTERVIEW_CHECKIN" // interviewed, silence for N days → polite check-in
  | "OFFER_RESPONSE"; // offer in hand → acknowledge + buy time to negotiate

export type FollowUpState = "PENDING" | "DONE" | "DISMISSED";

/** How time-critical a nudge is, relative to the injected `now`. */
export type FollowUpUrgency = "overdue" | "due" | "upcoming";

/**
 * The application state the cadence reasons over. All timestamps are ISO-8601
 * strings; absent fields mean "unknown / not yet happened". Prisma-free; the
 * service maps DB rows into this and tests build it directly.
 */
export interface ApplicationTimeline {
  applicationId: string;
  company: string;
  jobTitle?: string;
  status: FollowUpAppStatus;
  /** When the application was submitted. */
  appliedAt?: string;
  /** Last outbound/inbound contact on the thread (suppresses premature nudges). */
  lastContactAt?: string;
  /** When the most recent interview happened (drives thank-you + check-in). */
  lastInterviewAt?: string;
  /** A stated employer deadline ("we'll get back to you by …"), if known. */
  nextDeadlineAt?: string;
}

/**
 * A computed follow-up. `dueAt` is when the user should act; `urgency` is
 * derived from `dueAt` vs the injected `now`. The draft is polite + specific and
 * is never sent automatically.
 */
export interface FollowUp {
  kind: FollowUpKind;
  /** ISO-8601 - when to send. May be in the past (urgency "overdue"). */
  dueAt: string;
  urgency: FollowUpUrgency;
  draftSubject: string;
  draftBody: string;
  /** Plain-language reason this nudge exists (always populated). */
  rationale: string;
}

// --- Cadence tuning (days/hours) ------------------------------------------

/** Wait this many days after applying before the first "reiterate interest" nudge. */
export const APPLICATION_NUDGE_DAYS = 6;
/** Send the post-interview thank-you within this many hours. */
export const THANK_YOU_HOURS = 24;
/** After an interview, wait this many days of silence before a check-in. */
export const POST_INTERVIEW_CHECKIN_DAYS = 7;
/** Acknowledge an offer within this many hours (then negotiate). */
export const OFFER_RESPONSE_HOURS = 48;

/** Statuses at which the cadence stops producing generic nudges. */
export const TERMINAL_STATUSES: ReadonlySet<FollowUpAppStatus> =
  new Set<FollowUpAppStatus>(["REJECTED", "SKIPPED"]);

// --- Serializable view model (service + pipeline → UI) ---------------------

export interface FollowUpView {
  /** FollowUp id (DB) or a synthetic id in the offline preview. */
  id: string;
  applicationId: string;
  company: string;
  jobTitle?: string;
  kind: FollowUpKind;
  /** ISO-8601 due date. */
  dueAt: string;
  urgency: FollowUpUrgency;
  draftSubject: string;
  draftBody: string;
  rationale: string;
  state: FollowUpState;
}
