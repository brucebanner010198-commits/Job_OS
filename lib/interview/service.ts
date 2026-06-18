/**
 * Interview-prep data SERVICE (Phase 8, plan §5) - the ONLY file in this module
 * that imports @/lib/db. Every Prisma read/write lives here; the four brains
 * (study, persona, guard, score) and the pipeline stay DB-free and unit-testable.
 *
 * Safety spine enforced here (plan §5, Hardening §A/§B/§E):
 *   - EXTRACTIVE STUDY: a guide is built by buildStudyGuide from the user's REAL
 *     ProfileEntries; we persist its provenanceOk verbatim. It never invents a
 *     company, a metric, or an experience.
 *   - SENSITIVE FACTS NEVER LEAVE: ProfileEntry rows carry a `sensitive` flag into
 *     the ProfileFact shape; every brain filters sensitive facts BEFORE use, so no
 *     sensitive text (e.g. "chronic health condition") can reach a guide, a
 *     persona prompt, an opener, or a transcript. We pass the flag, never assume.
 *   - COST IS CAPPED: live voice is the one variable cost. startLiveSession refuses
 *     (no session, no grant) the instant decideStart says the daily kill-switch has
 *     tripped; finishSession books LIVE seconds into the day's VoiceUsage so the
 *     kill-switch is honest. STUDY never mints a live grant.
 *   - KEY STAYS SERVER-SIDE: a grant is minted through getVoiceSource(); only the
 *     short-lived signed URL crosses to the client, never the ELEVENLABS_API_KEY.
 *   - CLOCK: reads stamp "now" with the standard Date (like lib/warm/service.ts),
 *     then feed that ISO string into the clock-injected guard (dayKey/decideStart).
 *   - getInterviewBoard NEVER THROWS - a failing read degrades to the offline
 *     preview so the page always renders.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildStudyGuide } from "@/lib/interview/study";
import { buildPersona } from "@/lib/interview/persona";
import { dayKey, decideStart } from "@/lib/interview/guard";
import { scoreSession } from "@/lib/interview/score";
import { getVoiceSource, voiceStatus } from "@/lib/interview";
import { previewInterview } from "@/lib/interview/pipeline";
import { flattenFact } from "@/lib/profile/types";
import type {
  AgentPersona,
  DailyUsage,
  InterviewBoardView,
  InterviewMode,
  InterviewPrepView,
  InterviewState,
  PrepAppStatus,
  PrepInput,
  ProfileFact,
  QAItem,
  SessionScore,
  SessionView,
  StartDecision,
  StudyGuide,
  TranscriptTurn,
  VoiceGrant,
} from "@/lib/interview/types";
import { DEFAULT_VOICE_CAPS } from "@/lib/interview/types";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";

// --- helpers ---------------------------------------------------------------

/** A persisted ProfileEntry row, narrowed to what the fact mapping needs. */
type ProfileEntryRow = {
  id: string;
  kind: string;
  data: unknown;
  sourceNote: string | null;
  sensitive: boolean;
};

/**
 * DB row → interview ProfileFact: flatten `data` (+ sourceNote) to searchable
 * text via the shared flattenFact, and carry the row's `sensitive` flag through
 * UNCHANGED. The brains filter on this flag, so a sensitive entry's text never
 * leaves - only the count of withheld facts surfaces.
 */
function toProfileFact(row: ProfileEntryRow): ProfileFact {
  return {
    id: row.id,
    kind: row.kind,
    text: flattenFact({
      id: row.id,
      kind: row.kind,
      data: row.data,
      sourceNote: row.sourceNote,
      sensitive: row.sensitive,
    }),
    sensitive: row.sensitive,
  };
}

/** Load the user's profile facts (with sensitive flags intact for the brains). */
async function loadFacts(scope: AppScope): Promise<ProfileFact[]> {
  const rows = await db.profileEntry.findMany({
    where: scopeWhere(scope),
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toProfileFact);
}

/**
 * Assemble the grounding PrepInput for a company: real role/JD from the linked
 * job (when there is one) plus the user's facts. Sensitive facts pass through
 * flagged - buildStudyGuide / buildPersona filter them before any use.
 */
async function buildPrep(
  scope: AppScope,
  company: string,
  role: string | null,
  applicationId: string | null,
  facts: ProfileFact[],
): Promise<PrepInput> {
  let jobDescription: string | undefined;
  let resolvedRole = role ?? undefined;
  if (applicationId) {
    const app = await db.application.findFirst({
      where: { id: applicationId, ...scopeWhere(scope) },
      include: { job: true },
    });
    if (app) {
      jobDescription = app.job.description ?? undefined;
      resolvedRole = resolvedRole ?? app.job.title;
    }
  }
  return {
    company,
    role: resolvedRole,
    jobDescription,
    facts,
    applicationId: applicationId ?? undefined,
  };
}

/** Pull a string `start` out of a parsed .ics CalendarEvent JSON, when present. */
function eventStart(event: unknown): string | undefined {
  if (event && typeof event === "object" && "start" in event) {
    const s = (event as { start?: unknown }).start;
    if (typeof s === "string" && s.length > 0) return s;
  }
  return undefined;
}

/** A persisted StudyGuide row → the StudyGuide view (questions are stored JSON). */
function guideFromRow(row: {
  company: string;
  role: string | null;
  questions: unknown;
  provenanceOk: boolean;
}): StudyGuide {
  return {
    company: row.company,
    role: row.role ?? undefined,
    questions: (row.questions as unknown as QAItem[]) ?? [],
    provenanceOk: row.provenanceOk,
    // The stored guide already excludes sensitive text; the count is not persisted.
    withheldSensitive: 0,
  };
}

/** A persisted InterviewSession row → the flattened SessionView. */
function toSessionView(row: {
  id: string;
  mode: string;
  state: string;
  durationSec: number | null;
  score: unknown;
  createdAt: Date;
}): SessionView {
  return {
    id: row.id,
    mode: row.mode as InterviewMode,
    state: row.state as InterviewState,
    durationSec: row.durationSec ?? undefined,
    score: (row.score as unknown as SessionScore) ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Today's DailyUsage for the kill-switch (zero when no row exists yet). */
async function dailyUsage(scope: AppScope, nowIso: string): Promise<DailyUsage> {
  const day = dayKey(nowIso);
  const row = await db.voiceUsage.findUnique({
    where: { profileId_day: { profileId: scope.profileId, day } },
  });
  return row
    ? { day: row.day, secondsUsed: row.secondsUsed, sessions: row.sessions }
    : { day, secondsUsed: 0, sessions: 0 };
}

// --- getInterviewBoard --------------------------------------------------------

/**
 * The live interview board: every interview-stage application (APPLIED /
 * INTERVIEWING / OFFER) with its always-free study guide, any prior sessions, and
 * the live-voice status + remaining daily budget.
 *
 *   - A persisted StudyGuide (unique by userId+company) wins; otherwise we build
 *     one on the fly from the user's ProfileEntries (sensitive text withheld).
 *   - fromInvite/interviewAt are surfaced when a Gmail INTERVIEW_INVITE InboxItem
 *     or an INTERVIEWING StatusProposal links the application (the .ics start
 *     drives interviewAt). This only PROPOSES a prep - it never starts a session.
 *   - dailyRemainingSec comes from decideStart over today's VoiceUsage.
 *
 * NEVER THROWS: any read failure degrades to the offline preview so the page
 * always renders.
 */
export async function getInterviewBoard(
  scope: AppScope,
): Promise<InterviewBoardView> {
  try {
    const apps = await db.application.findMany({
      where: {
        ...scopeWhere(scope),
        status: { in: ["APPLIED", "INTERVIEWING", "OFFER"] },
      },
      include: { job: true },
      orderBy: { createdAt: "desc" },
    });

    // Gmail interview invites → fromInvite + interviewAt (most recent per app).
    const invites = await db.inboxItem.findMany({
      where: {
        ...scopeWhere(scope),
        category: "INTERVIEW_INVITE",
        applicationId: { not: null },
      },
      orderBy: { receivedAt: "desc" },
    });
    const inviteByApp = new Map<string, { interviewAt?: string }>();
    for (const it of invites) {
      if (!it.applicationId || inviteByApp.has(it.applicationId)) continue;
      inviteByApp.set(it.applicationId, { interviewAt: eventStart(it.event) });
    }

    // An INTERVIEWING status proposal also marks a prep as invite-surfaced.
    const proposals = await db.statusProposal.findMany({
      where: {
        ...scopeWhere(scope),
        toStatus: "INTERVIEWING",
        applicationId: { not: null },
      },
    });
    const proposalApps = new Set<string>();
    for (const p of proposals) if (p.applicationId) proposalApps.add(p.applicationId);

    // Persisted guides (one per company) override an on-the-fly build.
    const guideRows = await db.studyGuide.findMany({ where: scopeWhere(scope) });
    const guideByCompany = new Map(guideRows.map((g) => [g.company, g] as const));

    // Prior sessions, most recent first, grouped by application.
    const sessionRows = await db.interviewSession.findMany({
      where: { ...scopeWhere(scope), applicationId: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    const sessionsByApp = new Map<string, SessionView[]>();
    for (const s of sessionRows) {
      if (!s.applicationId) continue;
      const arr = sessionsByApp.get(s.applicationId) ?? [];
      arr.push(toSessionView(s));
      sessionsByApp.set(s.applicationId, arr);
    }

    // Facts are loaded once and reused for any on-the-fly guide build.
    const facts = await loadFacts(scope);

    const preps: InterviewPrepView[] = apps.map((app) => {
      const persisted = guideByCompany.get(app.job.company);
      const guide = persisted
        ? guideFromRow(persisted)
        : buildStudyGuide({
            company: app.job.company,
            role: app.job.title,
            jobDescription: app.job.description ?? undefined,
            facts,
            applicationId: app.id,
          });

      return {
        id: app.id,
        applicationId: app.id,
        company: app.job.company,
        role: app.job.title,
        status: app.status as PrepAppStatus,
        fromInvite: inviteByApp.has(app.id) || proposalApps.has(app.id),
        interviewAt: inviteByApp.get(app.id)?.interviewAt,
        guide,
        sessions: sessionsByApp.get(app.id) ?? [],
      };
    });

    const nowIso = new Date().toISOString();
    const caps = DEFAULT_VOICE_CAPS;
    const decision = decideStart(caps, await dailyUsage(scope, nowIso));

    return {
      preps,
      voice: voiceStatus(),
      caps,
      dailyRemainingSec: decision.dailyRemainingSec,
    };
  } catch {
    // NEVER throw - fall back to the deterministic offline preview.
    return previewInterview();
  }
}

// --- generateStudyGuide -------------------------------------------------------

/**
 * Build (and persist) the single study guide for a company. Grounds answers
 * in the user's NON-sensitive ProfileFacts + the linked job's title/description,
 * then upserts the one StudyGuide per (userId, company) - so re-generating
 * re-drafts in place rather than spamming rows. provenanceOk is stored verbatim.
 */
export async function generateStudyGuide(
  scope: AppScope,
  company: string,
  applicationId: string | null,
): Promise<void> {
  const facts = await loadFacts(scope);
  const prep = await buildPrep(scope, company, null, applicationId, facts);
  const guide = buildStudyGuide(prep);

  const data = {
    role: prep.role ?? null,
    questions: guide.questions as unknown as Prisma.InputJsonValue,
    provenanceOk: guide.provenanceOk,
  };

  await db.studyGuide.upsert({
    where: { profileId_company: { profileId: scope.profileId, company } },
    create: {
      ...scopeData(scope),
      company,
      applicationId: applicationId ?? null,
      ...data,
    },
    update: { applicationId: applicationId ?? null, ...data },
  });
}

// --- startLiveSession ---------------------------------------------------------

/**
 * Try to start a session. The guard runs FIRST: decideStart over today's
 * VoiceUsage. If the daily kill-switch has tripped (!allowed) we return the
 * decision with NOTHING else - no session row, no grant minted - so a blocked day
 * can never run up the bill. Otherwise we build the per-job persona, create an
 * IN_PROGRESS session, and (for LIVE modes only) mint a short-lived grant via the
 * voice seam. STUDY is free self-practice: it gets a session + facilitator persona
 * but NEVER a live grant.
 */
export async function startLiveSession(
  scope: AppScope,
  applicationId: string | null,
  company: string,
  role: string | null,
  mode: InterviewMode,
): Promise<{
  decision: StartDecision;
  grant: VoiceGrant | null;
  persona: AgentPersona | null;
  sessionId: string | null;
}> {
  const nowIso = new Date().toISOString();
  const decision = decideStart(DEFAULT_VOICE_CAPS, await dailyUsage(scope, nowIso));

  if (!decision.allowed) {
    // Daily kill-switch tripped - protect the bill: no session, no grant.
    return { decision, grant: null, persona: null, sessionId: null };
  }

  const facts = await loadFacts(scope);
  const prep = await buildPrep(scope, company, role, applicationId, facts);
  const persona = buildPersona(mode, prep);

  // STUDY has no paid voice; only LIVE modes mint a grant through the seam.
  const isLive = mode === "AI_SCREEN" || mode === "REAL_HR";
  const grant = isLive
    ? await getVoiceSource().grant(mode, persona, decision.grantedSec)
    : null;

  const session = await db.interviewSession.create({
    data: {
      ...scopeData(scope),
      applicationId: applicationId ?? null,
      company,
      role: prep.role ?? null,
      mode,
      state: "IN_PROGRESS",
      startedAt: new Date(),
    },
  });

  return { decision, grant, persona, sessionId: session.id };
}

// --- finishSession ------------------------------------------------------------

/**
 * Complete a session: score the transcript deterministically, then persist
 * transcript + score + duration + COMPLETED state. For LIVE modes the elapsed
 * seconds are booked into today's VoiceUsage (upsert by userId+day) so the daily
 * kill-switch stays honest. updateMany is user-scoped so it can only touch the
 * caller's own session.
 */
export async function finishSession(
  scope: AppScope,
  sessionId: string,
  transcript: TranscriptTurn[],
  durationSec: number,
  mode: InterviewMode,
): Promise<void> {
  const score = scoreSession(transcript, mode);

  await db.interviewSession.updateMany({
    where: { id: sessionId, ...scopeWhere(scope) },
    data: {
      transcript: transcript as unknown as Prisma.InputJsonValue,
      score: score as unknown as Prisma.InputJsonValue,
      durationSec,
      endedAt: new Date(),
      state: "COMPLETED",
    },
  });

  if (mode === "AI_SCREEN" || mode === "REAL_HR") {
    const day = dayKey(new Date().toISOString());
    await db.voiceUsage.upsert({
      where: { profileId_day: { profileId: scope.profileId, day } },
      create: {
        ...scopeData(scope),
        day,
        secondsUsed: durationSec,
        sessions: 1,
      },
      update: {
        secondsUsed: { increment: durationSec },
        sessions: { increment: 1 },
      },
    });
  }
}

// --- abortSession -------------------------------------------------------------

/** Abandon a session - ABORTED + endedAt now. No voice seconds are booked. */
export async function abortSession(
  scope: AppScope,
  sessionId: string,
): Promise<void> {
  await db.interviewSession.updateMany({
    where: { id: sessionId, ...scopeWhere(scope) },
    data: { state: "ABORTED", endedAt: new Date() },
  });
}

// --- offline preview (re-export) ----------------------------------------------

export { previewInterview } from "@/lib/interview/pipeline";
