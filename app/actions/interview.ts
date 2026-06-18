"use server";

/**
 * Interview-prep server actions (Phase 8). Thin wrappers over lib/interview/
 * service: resolve the primary user, call the service, revalidate /interview.
 *
 * These RETURN values - the client calls them from onClick handlers (to drive a
 * live session), NEVER from a <form action>. Each is wrapped in try/catch so a
 * transient failure never throws into a React Server Component render.
 *
 * Safety: nothing here starts a paid session on its own. startSessionAction only
 * runs after a human click, and the service still refuses (no session, no grant)
 * when the daily voice kill-switch has tripped.
 */

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  abortSession,
  finishSession,
  generateStudyGuide,
  startLiveSession,
} from "@/lib/interview/service";
import type {
  AgentPersona,
  InterviewMode,
  StartDecision,
  TranscriptTurn,
  VoiceGrant,
} from "@/lib/interview/types";

/** (Re)build and persist the extractive study guide for a company. */
export async function generateStudyGuideAction(
  company: string,
  applicationId: string | null,
): Promise<{ ok: boolean }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await generateStudyGuide(scope, company, applicationId);
    revalidatePath("/interview");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Start a session after a human click. Returns the guard decision plus (when
 * allowed) the persona, a short-lived grant, and the new session id so the client
 * can run the session. A blocked day comes back allowed=false with null grant /
 * session - the service minted nothing.
 */
export async function startSessionAction(
  company: string,
  applicationId: string | null,
  role: string | null,
  mode: InterviewMode,
): Promise<{
  ok: boolean;
  decision: StartDecision | null;
  grant: VoiceGrant | null;
  persona: AgentPersona | null;
  sessionId: string | null;
}> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    const result = await startLiveSession(
      scope,
      applicationId,
      company,
      role,
      mode,
    );
    revalidatePath("/interview");
    return { ok: true, ...result };
  } catch {
    return {
      ok: false,
      decision: null,
      grant: null,
      persona: null,
      sessionId: null,
    };
  }
}

/** Finish a session: score + persist the transcript; book LIVE seconds to usage. */
export async function finishSessionAction(
  sessionId: string,
  transcript: TranscriptTurn[],
  durationSec: number,
  mode: InterviewMode,
): Promise<{ ok: boolean }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await finishSession(scope, sessionId, transcript, durationSec, mode);
    revalidatePath("/interview");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Abandon a session - mark it ABORTED. No voice seconds are booked. */
export async function abortSessionAction(
  sessionId: string,
): Promise<{ ok: boolean }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await abortSession(scope, sessionId);
    revalidatePath("/interview");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
