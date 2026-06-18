/**
 * Interview-prep domain contract (Phase 8, plan §5) - the single source of truth
 * for every shape that crosses a module boundary: profile facts → study guide,
 * persona → voice grant, caps + usage → session guard, transcript → score, and
 * the serializable view models the page renders. DB-decoupled and Prisma-free, so
 * every "brain" (study, persona, guard, score) is pure and unit-testable with no
 * DB / network / LLM / wall-clock, and the UI imports these types directly.
 *
 * Safety spine (plan §5, Hardening §A/§B/§E):
 *   - EXTRACTIVE STUDY: a model answer is assembled only from the user's REAL
 *     profile facts; it never invents experience, a metric, or a company. An
 *     answer that can't be grounded sets provenanceOk=false.
 *   - SENSITIVE FACTS NEVER LEAVE: ProfileFacts flagged `sensitive` (health /
 *     family / protected-class life facts) are filtered out BEFORE study/persona
 *     run and never appear in a guide, a system prompt, or a transcript.
 *   - COST IS CAPPED: live voice is the one variable cost. The guard enforces a
 *     hard per-session limit, idle auto-hangup, and a daily-minutes kill-switch -
 *     all from injected time, never the system clock.
 *   - KEY STAYS SERVER-SIDE: the browser only ever receives a short-lived signed
 *     URL (VoiceGrant), never the ELEVENLABS_API_KEY.
 *   - PROPOSE, DON'T AUTO-START: a Gmail interview invite surfaces a prep; the
 *     human clicks to begin. No paid session ever starts itself.
 */

// --- Modes ------------------------------------------------------------------

/** The three progressive prep modes (mirrors Prisma InterviewMode). */
export type InterviewMode = "STUDY" | "AI_SCREEN" | "REAL_HR";

/** Session lifecycle (mirrors Prisma InterviewState). */
export type InterviewState = "READY" | "IN_PROGRESS" | "COMPLETED" | "ABORTED";

/** The application statuses a prep can attach to (subset of ApplicationStatus). */
export type PrepAppStatus =
  | "TO_APPLY"
  | "APPLIED"
  | "INTERVIEWING"
  | "OFFER";

export const INTERVIEW_MODES: readonly InterviewMode[] = [
  "STUDY",
  "AI_SCREEN",
  "REAL_HR",
] as const;

// --- Prep input (the grounding facts) -----------------------------------------

/**
 * One real fact from the master profile, flattened to display text. `sensitive`
 * marks health/family/protected-class life facts that MUST be filtered out
 * before any of these facts reach the study brain, a persona prompt, or a model.
 */
export interface ProfileFact {
  id: string;
  /** ProfileEntryKind string: EXPERIENCE | PROJECT | SKILL | ACHIEVEMENT | … */
  kind: string;
  /** Human-readable flattened text of the fact (e.g. a bullet, a skill name). */
  text: string;
  /** True → never used to ground an answer and never sent anywhere. */
  sensitive: boolean;
}

/**
 * Everything a prep is built from. `facts` should already EXCLUDE sensitive
 * entries before reaching study/persona - but the brains defend in depth and
 * filter again, and `withheldSensitive` records how many were withheld.
 */
export interface PrepInput {
  company: string;
  role?: string;
  jobDescription?: string;
  facts: ProfileFact[];
  applicationId?: string;
}

// --- Study guide (lib/interview/study.ts) -------------------------------------

export type QuestionCategory =
  | "BEHAVIORAL"
  | "ROLE_SPECIFIC"
  | "COMPANY_FIT"
  | "MOTIVATION"
  | "SITUATIONAL";

/** A STAR-structured model-answer scaffold (each part assembled from real facts). */
export interface StarParts {
  situation: string;
  task: string;
  action: string;
  result: string;
}

/** One likely question + its grounded model-answer scaffold + a delivery tip. */
export interface QAItem {
  question: string;
  category: QuestionCategory;
  /** A STAR model-answer scaffold built ONLY from real profile facts. */
  modelAnswer: string;
  starParts?: StarParts;
  /** Provenance: the ProfileFact ids this answer draws on (extractive). */
  usedFactIds: string[];
  /** Coaching tip for delivering the answer well. */
  tip: string;
}

export interface StudyGuide {
  company: string;
  role?: string;
  /** The top-5 most-likely questions, spanning categories. */
  questions: QAItem[];
  /** Extractive guard: false if an answer couldn't be grounded in a real fact. */
  provenanceOk: boolean;
  /** How many sensitive facts were intentionally withheld (never used). */
  withheldSensitive: number;
}

/** How many questions a study guide aims for (plan §5: "top 5"). */
export const STUDY_QUESTION_TARGET = 5;

// --- Persona (lib/interview/persona.ts) ---------------------------------------

/** Which ElevenLabs agent-id env var a persona maps to - two DISTINCT ids. */
export type AgentIdEnv = "ELEVENLABS_AGENT_AI_SCREEN" | "ELEVENLABS_AGENT_REAL_HR";

/**
 * A voice-agent persona, grounded per-job. The two live modes are deliberately
 * DISTINCT (no persona bleed): AI_SCREEN is robotic/structured/low-warmth;
 * REAL_HR is warm/human/high-warmth with harder multi-angle follow-ups. The
 * systemPrompt NEVER contains a sensitive fact.
 */
export interface AgentPersona {
  mode: InterviewMode;
  /** Display name of the interviewer (e.g. "Automated screener"). */
  name: string;
  /** One-line description of the interviewing style. */
  style: string;
  /** The voice agent's system prompt, grounded in company/role/JD. */
  systemPrompt: string;
  /** The opening line the interviewer speaks. */
  opener: string;
  /** The agent-id env var this persona binds to (distinct per live mode). */
  agentIdEnv: AgentIdEnv;
  /** 0..1 warmth - AI_SCREEN low, REAL_HR high (tests assert these differ). */
  warmth: number;
}

// --- Cost-cap / session guard (lib/interview/guard.ts) ------------------------

/**
 * The hard caps that contain the one variable cost in the system. All in
 * seconds. A 30-min ElevenLabs mock ≈ $2.40–4.80 + tokens, so these are real
 * money, not UX niceties.
 */
export interface VoiceCaps {
  /** Hard per-session ceiling. */
  maxSessionSec: number;
  /** Warn the user when this many seconds remain in the session. */
  warnAtRemainingSec: number;
  /** Idle auto-hangup: end after this many seconds with no candidate activity. */
  idleHangupSec: number;
  /** Daily-minutes kill-switch: total live seconds allowed per local day. */
  dailyCapSec: number;
}

export const DEFAULT_VOICE_CAPS: VoiceCaps = {
  maxSessionSec: 1800, // 30 min hard ceiling
  warnAtRemainingSec: 120, // warn at 2 min left
  idleHangupSec: 45, // hang up after 45s of silence
  dailyCapSec: 3600, // 60 min/day kill-switch
};

/** Per-day voice usage (drives the kill-switch). */
export interface DailyUsage {
  /** Local day key, "YYYY-MM-DD". */
  day: string;
  secondsUsed: number;
  sessions: number;
}

/** Whether a live session may start, and for how long. */
export interface StartDecision {
  allowed: boolean;
  /** Plain-language reason (shown to the user when blocked). */
  reason: string;
  /** Seconds this session may run = min(maxSessionSec, dailyRemaining). */
  grantedSec: number;
  dailyRemainingSec: number;
}

/** What the ticking guard tells the live session to do right now. */
export type TickAction = "continue" | "warn" | "hangup" | "idle_hangup";

export interface SessionTick {
  action: TickAction;
  elapsedSec: number;
  remainingSec: number;
  reason: string;
}

// --- Transcript + scoring (lib/interview/score.ts) ----------------------------

export type TurnRole = "interviewer" | "candidate";

export interface TranscriptTurn {
  role: TurnRole;
  text: string;
  /** Seconds since session start when the turn began. */
  atSec: number;
}

/**
 * A deterministic, heuristic score of a session transcript. Every sub-score is
 * 0..100. `starFixes` are concrete, per-answer rewrites; `flags` are short chips
 * (e.g. "filler", "no metrics", "rambling") for the UI.
 */
export interface SessionScore {
  clarity: number;
  structure: number; // STAR present + ordered?
  specificity: number; // concrete numbers / proper nouns?
  fit: number; // ties answers to the role/company?
  overall: number;
  starFixes: string[];
  notes: string[];
  flags: string[];
}

// --- Voice session source - the seam (fixture vs live ElevenLabs) -------------

/**
 * A grant the browser SDK uses to open a live session. The ELEVENLABS_API_KEY is
 * NEVER in here - only a short-lived signed URL. In fixture mode `signedUrl` is
 * empty and the UI plays the scripted MockScript instead (zero cost, no key).
 */
export interface VoiceGrant {
  signedUrl: string;
  agentId: string;
  /** Echo of the granted session budget for the client meter. */
  grantedSec: number;
  /** "fixture" | "elevenlabs". */
  provider: string;
  /** A scripted mock conversation to play when provider === "fixture". */
  mock?: MockScript;
}

/** Connect-card status for the live-voice capability. */
export interface VoiceStatus {
  /** Live voice configured (API key + ≥1 agent id present). */
  configured: boolean;
  /** Explicitly enabled (a kill-switch env can force it off). */
  enabled: boolean;
  provider: string;
  /** Human-readable why-not when not configured/enabled. */
  detail: string;
}

export interface VoiceSource {
  id: string;
  isLive: boolean;
  /**
   * Mint a grant for a session. Server-side only; never exposes the API key. In
   * fixture mode returns an empty signedUrl + a MockScript the UI plays.
   */
  grant(
    mode: InterviewMode,
    persona: AgentPersona,
    grantedSec: number,
  ): Promise<VoiceGrant>;
}

/**
 * A scripted mock conversation the fixture source / offline preview plays so the
 * entire live-session FLOW (turn-taking → transcript → score) is demonstrable
 * with no API key and zero cost.
 */
export interface MockScript {
  turns: TranscriptTurn[];
}

// --- Serializable view models (service + pipeline → UI) -----------------------
// One shape whether data is live (DB) or the offline preview, so the page renders
// identically in both modes.

/** A prior session, flattened for the UI. */
export interface SessionView {
  id: string;
  mode: InterviewMode;
  state: InterviewState;
  durationSec?: number;
  score?: SessionScore;
  /** ISO-8601. */
  createdAt: string;
}

/**
 * One prep target: the company/role, the always-available study guide (the free
 * offline core), whether Gmail auto-surfaced it from an interview invite, and any
 * prior sessions. The live modes layer on top when configured.
 */
export interface InterviewPrepView {
  id: string;
  applicationId?: string;
  company: string;
  role?: string;
  status: PrepAppStatus;
  /** Auto-surfaced by a Gmail INTERVIEW_INVITE proposal. */
  fromInvite: boolean;
  /** ISO-8601 interview time, when an .ics invite provided one. */
  interviewAt?: string;
  guide: StudyGuide;
  sessions: SessionView[];
}

/** The whole board: prep targets + the live-voice status + daily budget left. */
export interface InterviewBoardView {
  preps: InterviewPrepView[];
  voice: VoiceStatus;
  caps: VoiceCaps;
  dailyRemainingSec: number;
}
