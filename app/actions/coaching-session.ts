"use server";

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { saveNote } from "@/lib/profile/service";
import { compileWeeklyWorkLogs, createWorkLog } from "@/lib/journal/service";
import {
  extractCoachingSessionInsights,
  type CoachingSessionInsights,
} from "@/lib/coaching/session-processor";

export interface ProcessSessionResult {
  ok: boolean;
  insights?: CoachingSessionInsights;
  error?: string;
}

export interface SaveSessionResult {
  ok: boolean;
  workLogId?: string;
  achievementsAdded?: number;
  error?: string;
}

/**
 * Process a daily coaching voice transcript with LLM or local heuristic engine.
 */
export async function processCoachingSessionAction(
  transcript: string,
): Promise<ProcessSessionResult> {
  await requireAccessForMutation();
  const text = transcript.trim();
  if (!text) {
    return { ok: false, error: "Transcript is empty. Please speak or type your daily notes." };
  }

  try {
    const insights = await extractCoachingSessionInsights(text);
    return { ok: true, insights };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to process coaching session.",
    };
  }
}

/**
 * Save synthesized coaching session insights directly to the Career Journal
 * and optionally update the user's Master Career Profile.
 */
export async function saveCoachingSessionAction(
  insights: CoachingSessionInsights,
  rawTranscript: string,
  addToProfile = true,
): Promise<SaveSessionResult> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();

  try {
    // 1. Create a work journal entry
    const tasksDone = insights.achievements.map((a) => a.description).join("\n") || insights.summary;
    const pointOfView = [
      ...insights.technicalDecisions,
      ...insights.coachingNotes.map((n) => `Coach note: ${n}`),
    ].join("\n");

    const metrics = insights.achievements
      .filter((a) => a.metric)
      .map((a) => ({
        label: a.description.slice(0, 60),
        delta: a.metric!,
      }));

    const workLog = await createWorkLog(scope, {
      title: insights.title,
      tasksDone,
      pointOfView,
      category: insights.category,
      rawContext: rawTranscript,
      metrics,
      tags: [...insights.skills, "coaching-session"],
    });

    // 2. Save the raw session transcript as a permanent ProfileNote for provenance
    await saveNote(scope, rawTranscript, null, "coaching_session");

    // 3. Turn the session into draft bullets for review. Nothing reaches the
    //    master resume until the user approves each one on the journal page.
    let achievementsAdded = 0;
    if (addToProfile) {
      const { bulletsCreated } = await compileWeeklyWorkLogs(scope);
      achievementsAdded = bulletsCreated;
    }

    revalidatePath("/journal");
    revalidatePath("/master-resume");
    revalidatePath("/setup");

    return {
      ok: true,
      workLogId: workLog.id,
      achievementsAdded,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to save session.",
    };
  }
}
