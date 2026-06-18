/**
 * Warm-path / referral engine contract (Phase 7, plan §9 + Module 9) - the
 * single source of truth for the shapes that cross module boundaries:
 * ConnectionSource → rank (paths-in) → "should you even reach out" gate →
 * extractive intro DRAFT → review. DB-decoupled and Prisma-free so every brain
 * (rank, draft) is pure and unit-testable with no DB/network, and the UI can
 * import these types directly.
 *
 * Safety spine (plan §9, Hardening §B/§F):
 *   - TRUTHFUL / EXTRACTIVE: an intro draft is grounded ONLY in real facts about
 *     the connection (name, how you actually know them, shared context) and the
 *     user's real profile. It NEVER invents a relationship, a shared employer, or
 *     a claim. `provenanceOk=false` blocks the "mark sent" affordance, exactly
 *     like the resume/cover-letter provenance gate.
 *   - HUMAN-IN-THE-LOOP, DRAFT-FIRST: the engine only ever PROPOSES + drafts; it
 *     NEVER sends anything. The human edits and sends from their own account.
 *   - LOW-VOLUME / ETIQUETTE: at most ONE ask per company; the reach-out gate can
 *     say NO (no genuine path, or a normal portal exists) rather than manufacture
 *     a tenuous reason to message someone.
 *   - OWN ACCOUNT ONLY: discovery uses the user's own LinkedIn session, locally,
 *     human-in-the-loop - never scraping others at scale.
 */

// --- Connection (what a ConnectionSource yields) --------------------------

/** How the user knows this person - drives both path strength and the draft. */
export type ConnectionRelationship =
  | "COLLEAGUE" // worked together (current or former)
  | "ALUMNI" // same school / program
  | "MUTUAL" // connected via a shared contact
  | "COMMUNITY" // same group / open-source / conference / meetup
  | "FRIEND" // personal friend
  | "OTHER";

/**
 * A person in the user's network. The live adapter maps a LinkedIn session row
 * into this shape; fixtures build it directly. Prisma-free, fully serializable.
 * `howKnown` / `sharedContext` are REAL grounding facts the draft may quote -
 * the draft must never assert a tie that isn't present here.
 */
export interface Connection {
  /** DB id when persisted; omitted for source/fixture rows. */
  id?: string;
  fullName: string;
  /** Their LinkedIn headline, e.g. "Staff Engineer at Stripe". */
  headline?: string;
  /** Current employer (used to match a target company). */
  company?: string;
  /** Lowercased employer domain, e.g. "stripe.com" (for domain matching). */
  companyDomain?: string;
  title?: string;
  relationship: ConnectionRelationship;
  /** 1st / 2nd / 3rd degree. 1 is strongest. */
  degree: 1 | 2 | 3;
  /** A real, specific grounding fact, e.g. "we worked together at Acme". */
  howKnown?: string;
  /** A real shared detail, e.g. "both on the payments team 2019–2021". */
  sharedContext?: string;
  profileUrl?: string;
  /** Provenance of the row. */
  source: "linkedin" | "import" | "manual" | "fixture";
}

// --- Target (a company the user wants a path into) ------------------------

/** A company the user is targeting - usually a WARM_PATH / TO_APPLY application. */
export interface WarmTarget {
  company: string;
  /** Lowercased company domain, e.g. "notion.so". */
  companyDomain?: string;
  jobTitle?: string;
  /** Linked Application id, when this target is an existing application. */
  applicationId?: string;
}

// --- Ranked path-in (lib/warm/rank.ts) ------------------------------------

/**
 * The kind of path the user has into a company - strongest first. NONE means no
 * genuine connection was found (the engine then recommends applying cold rather
 * than fabricating a tie).
 */
export type PathKind =
  | "CURRENT_COLLEAGUE" // a 1st-degree contact who works there NOW
  | "FORMER_COLLEAGUE" // a 1st-degree contact you worked with, now there
  | "ALUMNI" // an alum who works there
  | "MUTUAL_CONNECTION" // a 2nd-degree path via a shared contact
  | "COMMUNITY" // a community/OSS/conference tie who works there
  | "FRIEND" // a personal friend who works there
  | "NONE";

/** Communication channel for the drafted ask. */
export type IntroChannel = "linkedin" | "email";

/**
 * A scored path into a target company. `reachOut` is the etiquette gate: false
 * means "don't message - apply normally instead" (e.g. NONE, or a path too weak
 * to justify the ask). `strength` (0..1) ranks the warm queue.
 */
export interface WarmPath {
  target: WarmTarget;
  /** The connection this path runs through (absent when pathKind is NONE). */
  connection?: Connection;
  pathKind: PathKind;
  /** 0..1 - CURRENT_COLLEAGUE strongest, COMMUNITY/FRIEND weaker, NONE = 0. */
  strength: number;
  /** Plain-language signals that drove the ranking (always populated). */
  reasons: string[];
  /** The "should you even reach out?" gate. False → recommend applying cold. */
  reachOut: boolean;
  /** Why the gate decided as it did (always populated). */
  gateReason: string;
  /** Suggested channel for the ask (1st-degree → linkedin/email; else linkedin). */
  channel: IntroChannel;
}

// --- Extractive intro draft (lib/warm/draft.ts) ---------------------------

/** Minimal real facts about the user, used to ground + sign the draft. */
export interface RequesterProfile {
  fullName: string;
  /** Current or most-recent role line, e.g. "Backend Engineer". */
  headline?: string;
  /** A real one-line reason the user is a fit (extractive - from the profile). */
  pitch?: string;
}

/**
 * A drafted intro/referral request. EXTRACTIVE: `usedFacts` lists every real
 * fact the body quotes (connection.howKnown, sharedContext, requester.headline,
 * target.company/jobTitle). `provenanceOk=false` (any asserted tie not present
 * in the inputs) blocks sending - the human sees the violation instead.
 */
export interface IntroDraft {
  channel: IntroChannel;
  /** Email subject (omitted for LinkedIn DMs, which have no subject). */
  subject?: string;
  body: string;
  /** True only when every claim in the body traces to an input fact. */
  provenanceOk: boolean;
  /** The real facts the draft is grounded in (provenance trail). */
  usedFacts: string[];
  /** Populated when provenanceOk is false - what couldn't be grounded. */
  violations: string[];
}

// --- Lifecycle ------------------------------------------------------------

export type WarmIntroState = "PROPOSED" | "SENT" | "SKIPPED";

// --- Connection source (live-vs-fixture, like JobSource / GmailSource) -----

export interface ConnectionListOptions {
  /** Bias discovery toward connections at these companies. */
  companies?: string[];
  /** Cap the number returned. */
  max?: number;
}

/**
 * A source of the user's network. The live adapter reads the user's OWN LinkedIn
 * session via the local browser (human-in-the-loop, never scraping at scale);
 * the fixture adapter returns a deterministic set. Implementations NEVER throw -
 * a missing session / disabled flag yields [].
 */
export interface ConnectionSource {
  /** Stable id, e.g. "fixture" | "linkedin-local". */
  id: string;
  /** True only for the real local-LinkedIn adapter. */
  isLive: boolean;
  listConnections(opts?: ConnectionListOptions): Promise<Connection[]>;
}

/** Reported to the UI for the connect/disconnect card. */
export interface WarmStatus {
  /** A live LinkedIn adapter is configured + enabled. */
  enabled: boolean;
  /** The local LinkedIn session is connected. */
  connected: boolean;
  /** The active source is the live one (vs fixtures). */
  live: boolean;
}

// --- Tuning constants (shared by brains + gate) ---------------------------

/** Etiquette: never more than this many asks per target company. */
export const MAX_ASKS_PER_COMPANY = 1;

/**
 * Below this path strength the reach-out gate recommends applying cold instead
 * of messaging - keeps the engine low-volume and relationship-safe.
 */
export const MIN_STRENGTH_TO_REACH_OUT = 0.4;

// --- Serializable view models (service + pipeline → UI) --------------------

export interface WarmPathView {
  /** WarmIntro id (DB) or a synthetic id in the offline preview. */
  id: string;
  company: string;
  jobTitle?: string;
  applicationId?: string;
  pathKind: PathKind;
  strength: number;
  reasons: string[];
  reachOut: boolean;
  gateReason: string;
  /** The connection's display name (absent for NONE paths). */
  connectionName?: string;
  connectionHeadline?: string;
  connectionProfileUrl?: string;
  channel: IntroChannel;
  /** The drafted ask (present once generated / in the preview). */
  draftSubject?: string;
  draftBody?: string;
  provenanceOk?: boolean;
  state: WarmIntroState;
}
