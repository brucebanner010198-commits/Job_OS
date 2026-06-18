/**
 * Salary coach data service (Phase 7 booster) - the ONLY @/lib/db importer for
 * the salary module, and READ-ONLY. The coach itself (lib/salary/negotiate.ts)
 * is a pure, provenance-strict calculator with no DB; this file just surfaces
 * the applications that have reached the OFFER stage so the user can pick one to
 * coach. It never persists or sends anything.
 *
 * Like getBoardView, this read is NOT internally guarded: a DB error propagates
 * so the page's safeDb wrapper can detect it and fall back to the offline
 * fixture preview.
 */
import { db } from "@/lib/db";
import type { AppScope } from "@/lib/profiles/types";
import { scopeWhere } from "@/lib/profiles/scope";

/**
 * The applications at the OFFER stage, with their company + job title. These are
 * the only candidates for the salary coach (it is triggered at OFFER). Ordered
 * most-recently-updated first.
 */
export async function listOfferApplications(
  scope: AppScope,
): Promise<{ applicationId: string; company: string; jobTitle?: string }[]> {
  const apps = await db.application.findMany({
    where: { ...scopeWhere(scope), status: "OFFER" },
    include: { job: true },
    orderBy: { updatedAt: "desc" },
  });

  return apps.map((app) => ({
    applicationId: app.id,
    company: app.job.company,
    jobTitle: app.job.title,
  }));
}
