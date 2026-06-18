"use server";

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  nonSensitiveProfileText,
  upsertGoal,
} from "@/lib/goals/service";
import { suggestGoalQuestions, synthesizeGoals } from "@/lib/goals/elicit";
import { normalizeMilestones, type CareerGoalData } from "@/lib/goals/types";

/** Tailored elicitation questions to get the user talking about direction. */
export async function suggestQuestionsAction(): Promise<string[]> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const profileText = await nonSensitiveProfileText(scope);
  return suggestGoalQuestions(profileText);
}

/** Organize the user's written/dictated direction into structured goals (preview, not saved). */
export async function synthesizeGoalsAction(
  note: string,
): Promise<CareerGoalData> {
  await requireAccessForMutation();
  const text = note.trim();
  if (!text) throw new Error("Write or dictate a few sentences about where you want to go first.");
  const { scope } = await getAppContext();
  const profileText = await nonSensitiveProfileText(scope);
  const data = await synthesizeGoals({ note: text, profileText });
  return { ...data, milestones: normalizeMilestones(data.milestones) };
}

/** Persist the (possibly user-edited) goals. */
export async function saveGoalsAction(
  data: CareerGoalData,
  rawNote: string,
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  await upsertGoal(scope, data, rawNote.trim() || null);
  revalidatePath("/goals");
  return { ok: true };
}
