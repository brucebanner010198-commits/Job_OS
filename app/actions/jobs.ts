"use server";

import { revalidatePath } from "next/cache";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { ingestAndScore } from "@/lib/jobs/service";

/**
 * Discover jobs for the given query, screen, score, and upsert them.
 * Empty query falls back to JOBS_DEFAULT_QUERY env var or "software engineer".
 */
export async function discoverJobsAction(
  query: string,
): Promise<{ ingested: number; kept: number; filtered: number }> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const q =
    query.trim() || (process.env.JOBS_DEFAULT_QUERY ?? "software engineer");
  const counts = await ingestAndScore(scope, q);
  revalidatePath("/jobs");
  return counts;
}
