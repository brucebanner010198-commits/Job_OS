"use server";

/**
 * Follow-up cadence server actions (Phase 7 booster). Thin wrappers over
 * lib/followup/service: resolve the primary user, call the service, revalidate
 * /boosters. Every action is wrapped in try/catch and returns { ok:false } on
 * error so a transient failure never throws into a React Server Component render.
 *
 * Draft-first / human-in-the-loop: these actions only mark a nudge DONE or
 * DISMISSED, or trigger a recompute - none of them ever sends a message.
 */

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  dismissFollowUp,
  markFollowUpDone,
} from "@/lib/followup/service";

/**
 * Recompute + re-surface the user's follow-ups. There is nothing to write here:
 * getFollowUpViews recomputes on the next render, so this just revalidates the
 * page (e.g. after the user edits an application elsewhere).
 */
export async function refreshFollowUpsAction(): Promise<{
  ok: boolean;
  error?: string;
}> {
  await requireAccessForMutation();
  try {
    revalidatePath("/boosters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not refresh follow-ups",
    };
  }
}

/** Human marks a follow-up handled - it leaves the live list. */
export async function markFollowUpDoneAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await markFollowUpDone(scope, id);
    revalidatePath("/boosters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not mark follow-up done",
    };
  }
}

/** Human dismisses a follow-up - it won't be resurrected on the next re-compute. */
export async function dismissFollowUpAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await dismissFollowUp(scope, id);
    revalidatePath("/boosters");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not dismiss follow-up",
    };
  }
}
