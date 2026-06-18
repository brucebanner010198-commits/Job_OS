/**
 * Scheduler SERVICE (Phase 9) - the ONLY file in this module that imports
 * @/lib/db. It reads/writes the ScheduledRun watermark rows and assembles the
 * OpsView for the dashboard. The planning, launchd, and push-relay logic all live
 * in pure modules; this is just the persistence + cwd seam.
 *
 * getOpsView NEVER THROWS: a read failure degrades to the offline preview.
 * recordRun is the watermark advance the catch-up runner calls after each job, so
 * a just-run job is no longer "due" on the next plan - the idempotency guarantee.
 */
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { processOps, previewOps } from "@/lib/scheduler/pipeline";
import type { RunWatermark } from "@/lib/scheduler/plan";
import type { JobKind, OpsView, RunStatus } from "@/lib/scheduler/types";

/** Pull a string detail back out of the stored JSON receipt. */
function detailString(detail: unknown): string | undefined {
  return typeof detail === "string" ? detail : undefined;
}

/** Read every ScheduledRun watermark row for a user (DB-decoupled shape). */
export async function loadWatermarks(scope: AppScope): Promise<RunWatermark[]> {
  const rows = await db.scheduledRun.findMany({ where: scopeWhere(scope) });
  return rows.map((r) => ({
    kind: r.kind as JobKind,
    lastRunAt: r.lastRunAt?.toISOString(),
    lastStatus: (r.lastStatus as RunStatus | null) ?? undefined,
    lastDetail: detailString(r.lastDetail),
    runs: r.runs,
  }));
}

/**
 * The live Automation view: real watermarks + this process's working directory
 * (so the launchd plist points at the right repo) + now. Never throws.
 */
export async function getOpsView(scope: AppScope): Promise<OpsView> {
  try {
    const watermarks = await loadWatermarks(scope);
    return processOps({
      watermarks,
      cwd: process.cwd(),
      nowIso: new Date().toISOString(),
    });
  } catch {
    return previewOps();
  }
}

/**
 * Advance a job's watermark after the runner ran it. Upserts the one row per
 * (user, kind): lastRunAt → now, runs += 1, and records the status + a short
 * detail string. This is what flips a just-run job to "not due".
 */
export async function recordRun(
  scope: AppScope,
  kind: JobKind,
  status: RunStatus,
  detail?: string,
): Promise<void> {
  const lastDetail = (detail ?? null) as unknown as Prisma.InputJsonValue;
  await db.scheduledRun.upsert({
    where: { profileId_kind: { profileId: scope.profileId, kind } },
    create: {
      ...scopeData(scope),
      kind,
      lastRunAt: new Date(),
      lastStatus: status,
      lastDetail,
      runs: 1,
    },
    update: {
      lastRunAt: new Date(),
      lastStatus: status,
      lastDetail,
      runs: { increment: 1 },
    },
  });
}

export { previewOps } from "@/lib/scheduler/pipeline";
