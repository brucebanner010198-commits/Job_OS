"use server";

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  upsertAnswers,
  prepareApplication,
  approveAndSubmit,
} from "@/lib/apply/service";
import type { ApplicationAnswersData, ApplyState } from "@/lib/apply/types";

/** Persist the user's confirmed standard answers (work auth, salary, links, etc.). */
export async function saveAnswersAction(
  data: ApplicationAnswersData,
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  await upsertAnswers(scope, data);
  revalidatePath("/apply");
  return { ok: true };
}

/**
 * Prepare an application for a queued job (AI builds the field plan).
 * `jobId` is the Job's `identityHash` (what JobView.id returns from listQueue).
 */
export async function prepareApplicationAction(
  jobId: string,
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  await prepareApplication(scope, jobId);
  revalidatePath("/apply");
  return { ok: true };
}

/**
 * Human approves the itemized review gate → attempt simulated submit.
 * Returns the resulting applyState so the UI can update without a full reload.
 */
export async function approveSubmitAction(
  applicationId: string,
): Promise<{ ok: boolean; state: ApplyState }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const result = await approveAndSubmit(scope, applicationId);
  revalidatePath("/apply");
  return result;
}

export async function takeControlAction(
  applicationId: string,
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const { takeControl } = await import("@/lib/apply/session-service");
  takeControl(scope, applicationId);
  revalidatePath("/apply");
  return { ok: true };
}

export async function resumeAiAction(
  applicationId: string,
): Promise<{ ok: true }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const { resumeAi } = await import("@/lib/apply/session-service");
  resumeAi(scope, applicationId);
  revalidatePath("/apply");
  return { ok: true };
}
