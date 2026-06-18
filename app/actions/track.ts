"use server";

/**
 * Track + Gmail server actions (Phase 6). Thin wrappers over lib/track/service:
 * resolve the primary user, call the service, revalidate /track. Every action
 * is wrapped in try/catch and returns { ok:false, ... } on error so a transient
 * failure never throws into a React Server Component render.
 */

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  syncInbox,
  confirmProposal,
  dismissProposal,
  moveApplication,
  disconnectGmail,
} from "@/lib/track/service";
import type { AppStatus } from "@/lib/track/types";

/** Pull + classify the inbox, surfacing pending status proposals. Idempotent. */
export async function syncInboxAction(): Promise<{
  ok: boolean;
  created: number;
  proposals: number;
  live: boolean;
  error?: string;
}> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    const result = await syncInbox(scope);
    revalidatePath("/track");
    return {
      ok: true,
      created: result.created,
      proposals: result.proposals,
      live: result.live,
    };
  } catch (err) {
    return {
      ok: false,
      created: 0,
      proposals: 0,
      live: false,
      error: err instanceof Error ? err.message : "Inbox sync failed",
    };
  }
}

/** Human confirms a proposal → the ONLY path that applies a Gmail-derived move. */
export async function confirmProposalAction(
  proposalId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await confirmProposal(scope, proposalId);
    revalidatePath("/track");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not confirm proposal",
    };
  }
}

/** Human declines a proposal - the application's status is left untouched. */
export async function dismissProposalAction(
  proposalId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await dismissProposal(scope, proposalId);
    revalidatePath("/track");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not dismiss proposal",
    };
  }
}

/** Manual drag of an application to a new Kanban column. */
export async function moveApplicationAction(
  applicationId: string,
  toStatus: AppStatus,
): Promise<{ ok: boolean }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await moveApplication(scope, applicationId, toStatus);
    revalidatePath("/track");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Forget the OAuth tokens and mark the Gmail account disconnected. */
export async function disconnectGmailAction(): Promise<{ ok: boolean }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await disconnectGmail(scope);
    revalidatePath("/track");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
