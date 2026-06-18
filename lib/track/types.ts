/**
 * Track + Gmail domain contract (Phase 6) - the single source of truth for the
 * shapes that cross module boundaries: Gmail source → threading → .ics parse →
 * classify → status PROPOSAL → Kanban board. DB-decoupled and Prisma-free so
 * every "brain" (ics, classify, proposals, threading, sync, board) is pure and
 * unit-testable with no DB/network, and the UI can import these types directly.
 *
 * Safety spine (plan §8d, Hardening §F):
 *   - Gmail classification PROPOSES; it NEVER auto-flips status to
 *     INTERVIEWING / OFFER / REJECTED. A mislabeled "offer" or a missed invite
 *     is the worst possible bug → those moves are always human-confirmed.
 *   - Calendar invites are parsed from the `.ics` MIME part, not body guesswork.
 *   - Re-sync is idempotent: emails dedupe by Gmail message id.
 */

// --- Raw email (what a GmailSource yields) --------------------------------

/**
 * A single inbound email reduced to the signals the brain reasons over. The
 * live adapter maps a Gmail message payload into this shape; fixtures build it
 * directly. Prisma-free, fully serializable.
 */
export interface RawEmail {
  gmailMessageId: string;
  gmailThreadId: string;
  /** RFC 822 Message-ID header (e.g. "<abc@mail.gmail.com>"). */
  rfcMessageId?: string;
  /** RFC 822 References + In-Reply-To message-ids (threading). */
  references: string[];
  /** Full From header, e.g. `Stripe Recruiting <recruiting@stripe.com>`. */
  from: string;
  /** Just the address, lowercased. */
  fromEmail: string;
  fromName?: string;
  /** Domain of fromEmail, lowercased (e.g. "stripe.com"). */
  fromDomain?: string;
  to: string[];
  subject: string;
  snippet?: string;
  bodyText?: string;
  /** ISO-8601 receive time. */
  receivedAt: string;
  labelIds: string[];
  /** True when a List-Unsubscribe header is present → bulk/marketing signal. */
  listUnsubscribe: boolean;
  /** Raw `text/calendar` MIME part, when the email carries an invite. */
  icsRaw?: string;
}

// --- Calendar event (lib/track/ics.ts) ------------------------------------

/** A VEVENT parsed from an `.ics` MIME part (not body guesswork). */
export interface CalendarEvent {
  uid?: string;
  /** iTIP method: REQUEST (new/updated invite) | CANCEL | REPLY | … */
  method?: string;
  summary?: string;
  /** ISO-8601 start; date-only ("2026-06-22") when allDay. */
  start?: string;
  end?: string;
  location?: string;
  organizer?: string;
  /** DTSTART was a VALUE=DATE (no time component). */
  allDay: boolean;
  /** METHOD:CANCEL or STATUS:CANCELLED. */
  cancelled: boolean;
}

// --- Classification (lib/track/classify.ts) -------------------------------

/**
 * The job-search relevance class of an email. NOT_JOB is the critical default
 * for the flood of newsletters/notifications that merely *contain* words like
 * "application" or "interview" (e.g. a GitHub "third-party application added"
 * security notice, or "career prep" marketing) - those must never become a
 * status proposal.
 */
export type EmailCategory =
  | "INTERVIEW_INVITE"
  | "ASSESSMENT"
  | "RECRUITER_OUTREACH"
  | "APPLICATION_RECEIVED"
  | "SOFT_REJECTION"
  | "REJECTION"
  | "OFFER"
  | "NOT_JOB";

export interface ClassificationResult {
  category: EmailCategory;
  /** 0..1 confidence in the category. */
  confidence: number;
  /** Plain-language signals that drove the decision (always populated). */
  reasons: string[];
  /** Convenience: category !== "NOT_JOB". */
  isJobRelated: boolean;
}

// --- Status / board (mirrors Prisma ApplicationStatus) --------------------

export type AppStatus =
  | "WARM_PATH"
  | "TO_APPLY"
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER"
  | "REJECTED"
  | "SKIPPED";

/** The Kanban columns, left → right, in pipeline order. */
export const BOARD_COLUMNS: readonly AppStatus[] = [
  "WARM_PATH",
  "TO_APPLY",
  "APPLIED",
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
] as const;

/**
 * Statuses the system NEVER auto-applies (plan §8d). A move *into* any of these
 * is always surfaced as a confirm-required proposal - automation only ever
 * proposes them, the human commits them.
 */
export const NEVER_AUTO_STATUSES: ReadonlySet<AppStatus> = new Set<AppStatus>([
  "INTERVIEWING",
  "OFFER",
  "REJECTED",
]);

// --- Threading (lib/track/threading.ts) -----------------------------------

/**
 * A minimal, Prisma-free view of an Application used by threading + proposals.
 * The service maps DB rows into this; tests build it directly.
 */
export interface AppRef {
  /** Application id. */
  id: string;
  status: AppStatus;
  company: string;
  /** Lowercased company email domain, e.g. "stripe.com" (for domain matching). */
  companyDomain?: string;
  jobTitle?: string;
  /** Known Gmail thread ids already linked to this application. */
  gmailThreadIds: string[];
  /** Known RFC Message-IDs already linked (for References matching). */
  rfcMessageIds: string[];
}

export type ThreadMatchKind = "thread" | "references" | "domain" | "subject" | "none";

export interface ThreadMatch {
  applicationId?: string;
  matchedBy: ThreadMatchKind;
  /** 0..1 - "thread" is strongest, "subject" weakest. */
  confidence: number;
}

// --- Status proposal (lib/track/proposals.ts) -----------------------------

/**
 * A PROPOSED status change. `requiresConfirm` is true whenever `toStatus` is in
 * NEVER_AUTO_STATUSES (and we keep it true everywhere by default - the human is
 * the gate). `soft` flags a "we'll keep your resume on file" close-out so the
 * UI can distinguish it from a hard rejection.
 */
export interface StatusProposal {
  toStatus: AppStatus;
  fromStatus?: AppStatus;
  rationale: string;
  requiresConfirm: boolean;
  soft: boolean;
}

// --- Incremental sync (lib/track/sync.ts) ---------------------------------

export interface SyncState {
  /** Gmail historyId watermark from the last successful sync. */
  historyId?: string;
  /** ISO-8601 of the last successful sync. */
  lastSyncedAt?: string;
}

export interface SyncPlan {
  /** "full" when there is no watermark yet; otherwise "incremental". */
  mode: "full" | "incremental";
  /** Present in incremental mode - fetch history since this id. */
  sinceHistoryId?: string;
  /** For a full pull: how many days back to look (speed-first default). */
  lookbackDays: number;
  /** A Gmail search query that biases toward job-related mail. */
  query: string;
}

// --- Composed ingest (lib/track/pipeline.ts) ------------------------------

/** One fully-processed email: classification + parsed event + thread match. */
export interface ProcessedEmail {
  email: RawEmail;
  classification: ClassificationResult;
  event?: CalendarEvent;
  match: ThreadMatch;
  /** The proposal this email generates, or null when none is warranted. */
  proposal: StatusProposal | null;
}

// --- Serializable view models (service + pipeline → UI) --------------------
// One shape whether the data is live (DB) or the offline preview, so the page
// renders identically in both modes.

export interface BoardAppView {
  id: string;
  company: string;
  jobTitle?: string;
  status: AppStatus;
  /** AutonomyRoute string, when known (for a small badge). */
  route?: string | null;
}

export interface BoardColumnView {
  status: AppStatus;
  title: string;
  apps: BoardAppView[];
}

/** A pending status proposal, flattened with its source email for the UI. */
export interface ProposalView {
  /** Proposal id (DB), or a synthetic id in the offline preview. */
  id: string;
  category: EmailCategory;
  toStatus: AppStatus;
  fromStatus?: AppStatus;
  rationale: string;
  soft: boolean;
  requiresConfirm: boolean;
  company?: string;
  subject: string;
  fromEmail: string;
  /** ISO-8601 receive time. */
  receivedAt: string;
  /** ISO-8601 event start, when a calendar invite was parsed. */
  eventStart?: string;
  eventCancelled?: boolean;
  applicationId?: string;
  /** Gmail snippet for rejection explainer (offline preview + live). */
  snippet?: string;
}
