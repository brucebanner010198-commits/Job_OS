/**
 * Follow-up cadence data service (Phase 7 booster) - the ONLY file in the
 * follow-up module that imports @/lib/db. The cadence brain + pipeline stay
 * DB-free and unit-testable; every Prisma read/write lives here.
 *
 * Safety spine enforced here (types.ts doc, plan §10):
 *   - NEVER nags / NEVER resurrects: the (applicationId, kind) unique guarantees
 *     at most one live nudge of a given kind per application, and an idempotent
 *     re-compute NEVER flips a DONE/DISMISSED row back to PENDING - once the user
 *     has acted on a nudge it stays decided.
 *   - STOPS on a terminal status: the cadence brain returns nothing for
 *     REJECTED/SKIPPED, so no nudge is ever created or surfaced for them.
 *   - DRAFT-FIRST: rows only ever carry drafts; nothing here sends a message.
 *   - getFollowUpViews NEVER throws - a DB outage degrades to [] so the page
 *     still renders (it can fall back to the offline preview).
 *   - The service MAY read the server clock (it is not the gated pure brain): it
 *     formats `now` as an ISO string and injects it into the pipeline.
 */
import { db } from "@/lib/db";
import { processFollowUps } from "@/lib/followup/pipeline";
import type {
  ApplicationTimeline,
  FollowUpAppStatus,
  FollowUpState,
  FollowUpView,
} from "@/lib/followup/types";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";

/**
 * Compute + persist the live follow-ups for a user, then return the ones still
 * PENDING. For each computed nudge we idempotently upsert a FollowUp row keyed
 * by (applicationId, kind): create it if absent, otherwise leave the existing
 * row untouched (so a DONE/DISMISSED decision is never undone). Only rows that
 * are still PENDING surface as views, with the persisted id + state merged in.
 * NEVER throws - any DB error degrades to an empty list.
 */
export async function getFollowUpViews(
  scope: AppScope,
): Promise<FollowUpView[]> {
  try {
    const apps = await db.application.findMany({
      where: scopeWhere(scope),
      include: { job: true },
    });

    // Map each application into the Prisma-free timeline the cadence reasons
    // over. lastInterviewAt is only known when the app is actively INTERVIEWING.
    const timelines: ApplicationTimeline[] = apps.map((app) => {
      const status = app.status as FollowUpAppStatus;
      return {
        applicationId: app.id,
        company: app.job.company,
        jobTitle: app.job.title,
        status,
        appliedAt: (app.submittedAt ?? app.createdAt).toISOString(),
        lastContactAt: app.updatedAt.toISOString(),
        lastInterviewAt:
          status === "INTERVIEWING" ? app.updatedAt.toISOString() : undefined,
      };
    });

    // The service is allowed to read the server clock; the brain is not.
    const nowIso = new Date().toISOString();
    const computed = processFollowUps(timelines, nowIso);

    const views: FollowUpView[] = [];
    for (const view of computed) {
      // Idempotent upsert by the (applicationId, kind) unique. An empty `update`
      // means an existing row is returned AS-IS - its state is never resurrected.
      const row = await db.followUp.upsert({
        where: {
          applicationId_kind: {
            applicationId: view.applicationId,
            kind: view.kind,
          },
        },
        create: {
          ...scopeData(scope),
          applicationId: view.applicationId,
          kind: view.kind,
          dueAt: new Date(view.dueAt),
          draftSubject: view.draftSubject,
          draftBody: view.draftBody,
          rationale: view.rationale,
          state: "PENDING",
        },
        update: {},
      });

      // Only live (PENDING) nudges surface; decided ones stay hidden.
      if (row.state !== "PENDING") continue;

      views.push({
        ...view,
        id: row.id,
        state: row.state as FollowUpState,
      });
    }

    return views;
  } catch {
    // NEVER throw to the caller - degrade to no nudges.
    return [];
  }
}

/** Human marks a nudge handled. Scoped by userId so one user can't decide another's. */
export async function markFollowUpDone(
  scope: AppScope,
  id: string,
): Promise<void> {
  await db.followUp.updateMany({
    where: { id, ...scopeWhere(scope) },
    data: { state: "DONE", decidedAt: new Date() },
  });
}

/** Human dismisses a nudge - it will not be resurrected on the next re-compute. */
export async function dismissFollowUp(
  scope: AppScope,
  id: string,
): Promise<void> {
  await db.followUp.updateMany({
    where: { id, ...scopeWhere(scope) },
    data: { state: "DISMISSED", decidedAt: new Date() },
  });
}

// --- offline preview (re-export) ----------------------------------------------

export { previewFollowUps } from "@/lib/followup/pipeline";
