/**
 * Interview-prep PIPELINE (Phase 8, plan §5). Pure orchestration - no DB, no
 * network, no LLM, no wall clock. It wires the always-free study core onto the
 * serializable view models the page renders:
 *
 *   PrepInput → buildStudyGuide (study.ts) → InterviewPrepView
 *
 * Because it is DB-free it powers the OFFLINE /interview preview (previewInterview)
 * and is fully unit-testable; lib/interview/service.ts builds the same view models
 * over real rows. Mirrors lib/warm/pipeline.ts (processWarmTargets / previewWarm).
 *
 * Safety spine (plan §5, Hardening §A/§B):
 *   - EXTRACTIVE: every prep's guide comes straight from buildStudyGuide, which
 *     assembles model answers ONLY from the prep's real ProfileFacts. provenanceOk
 *     flows through untouched so the UI can flag an ungrounded guide.
 *   - SENSITIVE FACTS NEVER LEAVE: buildStudyGuide filters sensitive facts BEFORE
 *     selection and only counts them (withheldSensitive); no sensitive text can
 *     reach a question, a model answer, or a tip surfaced here.
 *   - PROPOSE, DON'T AUTO-START: a view carries fromInvite/interviewAt for the
 *     UI's "begin" affordance but never starts a paid session - sessions is [].
 */

import type {
  InterviewBoardView,
  InterviewPrepView,
  PrepAppStatus,
  PrepInput,
} from "@/lib/interview/types";
import { DEFAULT_VOICE_CAPS } from "@/lib/interview/types";
import { buildStudyGuide } from "@/lib/interview/study";
import { voiceStatus } from "@/lib/interview";
import { fixturePreps } from "@/lib/interview/fixtures";

/**
 * Per-prep view metadata the caller layers on top of the pure study build. The
 * board service supplies these from real rows (a Gmail invite, a kanban status);
 * the offline preview supplies only fromInvite from the fixtures.
 */
export interface PrepMeta {
  /** Stable view id (defaults to "preview-"+company). */
  id?: string;
  /** Kanban status the prep attaches to (defaults to "INTERVIEWING"). */
  status?: PrepAppStatus;
  /** Auto-surfaced by a Gmail INTERVIEW_INVITE proposal (defaults to false). */
  fromInvite?: boolean;
  /** ISO-8601 interview time, when an .ics invite provided one. */
  interviewAt?: string;
}

export interface ProcessOpts {
  /** Per-prep metadata, parallel to `preps` by index. */
  meta?: PrepMeta[];
}

/**
 * Map one prep + its optional view metadata into a serializable prep view: build
 * the always-free study guide from real facts, default the status to INTERVIEWING,
 * and start with no sessions (a paid session is only ever started by an explicit
 * human click, never here).
 */
function toPrepView(prep: PrepInput, meta: PrepMeta | undefined): InterviewPrepView {
  const guide = buildStudyGuide(prep);
  return {
    id: meta?.id ?? `preview-${prep.company}`,
    applicationId: prep.applicationId,
    company: prep.company,
    role: prep.role,
    status: meta?.status ?? "INTERVIEWING",
    fromInvite: meta?.fromInvite ?? false,
    interviewAt: meta?.interviewAt,
    guide,
    sessions: [],
  };
}

/**
 * For each prep: build its extractive study guide and assemble the prep view,
 * applying any per-prep metadata (id / status / fromInvite / interviewAt) the
 * caller passes positionally. Deterministic and DB-free.
 */
export function processInterviewPreps(
  preps: PrepInput[],
  opts?: ProcessOpts,
): InterviewPrepView[] {
  return preps.map((prep, i) => toPrepView(prep, opts?.meta?.[i]));
}

/**
 * The deterministic offline preview - runs the full study pipeline over the
 * fixture preps (Stripe is fromInvite; Datadog has no facts so its guide flags
 * provenanceOk=false). Voice status is read from the seam (fixture when no key)
 * and, with no usage offline, the full daily budget remains. This is the board
 * the page falls back to when the DB is unreachable. Mirrors previewWarm.
 */
export function previewInterview(): InterviewBoardView {
  const preps = fixturePreps.map((f) => f.prep);
  const meta: PrepMeta[] = fixturePreps.map((f) => ({ fromInvite: f.fromInvite }));
  const caps = DEFAULT_VOICE_CAPS;
  return {
    preps: processInterviewPreps(preps, { meta }),
    voice: voiceStatus(),
    caps,
    // Offline: no VoiceUsage to read, so the whole day's budget is available.
    dailyRemainingSec: caps.dailyCapSec,
  };
}
