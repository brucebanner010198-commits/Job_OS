"use server";

/**
 * Warm-path server actions (Phase 7). Thin wrappers over lib/warm/service:
 * resolve the primary user, call the service, revalidate /warm-path. Every action
 * is wrapped in try/catch and returns { ok:false, ... } on error so a transient
 * failure never throws into a React Server Component render.
 *
 * Safety: these only PROPOSE/draft or record a human's own action - nothing here
 * sends a message. markIntroSentAction merely RECORDS that the human already sent
 * the ask themselves (and the service no-ops it on an ungrounded draft).
 */

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import {
  refreshConnections,
  generateIntro,
  markIntroSent,
  skipIntro,
} from "@/lib/warm/service";

/** Pull the user's own network into the DB. Idempotent; never sends anything. */
export async function refreshConnectionsAction(): Promise<{
  ok: boolean;
  created: number;
  live: boolean;
  error?: string;
}> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    const result = await refreshConnections(scope);
    revalidatePath("/warm-path");
    return { ok: true, created: result.created, live: result.live };
  } catch (err) {
    return {
      ok: false,
      created: 0,
      live: false,
      error: err instanceof Error ? err.message : "Could not refresh connections",
    };
  }
}

/** Draft (PROPOSE) the single warm-intro ask for a company. Never sends. */
export async function generateIntroAction(
  company: string,
  applicationId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await generateIntro(scope, company, applicationId);
    revalidatePath("/warm-path");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not generate intro draft",
    };
  }
}

/** Record that the human sent the ask themselves - no-op on an ungrounded draft. */
export async function markIntroSentAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await markIntroSent(scope, id);
    revalidatePath("/warm-path");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not mark intro as sent",
    };
  }
}

/** Dismiss the ask for this company. */
export async function skipIntroAction(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAccessForMutation();
  try {
    const { scope, user } = await getAppContext();
    await skipIntro(scope, id);
    revalidatePath("/warm-path");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not skip intro",
    };
  }
}
