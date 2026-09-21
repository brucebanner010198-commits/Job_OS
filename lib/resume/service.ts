/**
 * Resume persistence + background refresh for the career content agent.
 */
import { Prisma } from "@prisma/client";
import type { ResumeVersion } from "@prisma/client";
import { db } from "@/lib/db";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import {
  listFacts,
  toFacts,
  getContact,
  getProfileContentWatermark,
} from "@/lib/profile/service";
import { isTargetResumeStale } from "@/lib/career/staleness";
import { tailorResume, type TailorResult } from "@/lib/resume/tailor";
import { JobOSError } from "@/lib/errors/job-os-error";

export const MAX_TARGETS_PER_RUN = 5;

export function maxTargetsPerRun(): number {
  const n = parseInt(process.env.CAREER_AGENT_MAX_TARGETS ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : MAX_TARGETS_PER_RUN;
}

export async function saveTailoredResume(
  scope: AppScope,
  targetId: string,
  result: TailorResult,
): Promise<string> {
  const saved = await db.resumeVersion.create({
    data: {
      ...scopeData(scope),
      targetId,
      data: result.resume as unknown as Prisma.InputJsonValue,
      provenanceOk: result.provenance.ok,
      violations: result.provenance
        .violations as unknown as Prisma.InputJsonValue,
    },
  });
  return saved.id;
}

export async function getLatestResumeVersion(
  targetId: string,
): Promise<ResumeVersion | null> {
  return db.resumeVersion.findFirst({
    where: { targetId },
    orderBy: { createdAt: "desc" },
  });
}

export async function loadTargetContext(scope: AppScope, targetId: string) {
  const target = await db.target.findFirst({
    where: { id: targetId, ...scopeWhere(scope) },
  });
  if (!target) {
    throw JobOSError.notFound({
      domain: "job_os.resume",
      reason: "TARGET_NOT_FOUND",
      location: "lib/resume/service.ts:loadTargetContext",
      message: `Job target not found: ${targetId}.`,
      remedy: "Verify that the target exists in this profile or create a new target from the Jobs queue.",
      metadata: { targetId, profileId: scope.profileId, userId: scope.userId },
    });
  }

  const facts = toFacts(await listFacts(scope));
  if (facts.length === 0) {
    throw JobOSError.failedPrecondition({
      domain: "job_os.resume",
      reason: "FACTS_EMPTY",
      location: "lib/resume/service.ts:loadTargetContext",
      message: "Your master profile is empty. Add or import your background first.",
      remedy: "Navigate to the Master Resume or Setup page to import a resume or add career history facts.",
      metadata: { profileId: scope.profileId, userId: scope.userId },
    });
  }

  const [contact, user] = await Promise.all([
    getContact(scope),
    db.user.findUnique({ where: { id: scope.userId } }),
  ]);
  if (!user) {
    throw JobOSError.notFound({
      domain: "job_os.resume",
      reason: "USER_NOT_FOUND",
      location: "lib/resume/service.ts:loadTargetContext",
      message: `User account not found: ${scope.userId}.`,
      remedy: "Ensure your session is active or sign in again.",
      metadata: { userId: scope.userId },
    });
  }

  return { user, target, facts, contact };
}

export async function refreshTailoredResumes(
  scope: AppScope,
  opts?: { maxTargets?: number },
): Promise<{ refreshed: number; skipped: number }> {
  const profileWatermark = await getProfileContentWatermark(scope);
  const maxTargets = opts?.maxTargets ?? maxTargetsPerRun();

  const targets = await db.target.findMany({
    where: scopeWhere(scope),
    orderBy: { createdAt: "desc" },
    take: maxTargets,
  });

  let refreshed = 0;
  let skipped = 0;

  for (const target of targets) {
    const latest = await getLatestResumeVersion(target.id);
    if (!isTargetResumeStale(profileWatermark, latest)) {
      skipped++;
      continue;
    }

    try {
      const { user, facts, contact } = await loadTargetContext(
        scope,
        target.id,
      );
      const result = await tailorResume({
        facts,
        jobTitle: target.title,
        company: target.company,
        jobDescription: target.jobDescription,
        contact: {
          name: contact.name ?? user.name ?? user.email,
          email: contact.email,
          phone: contact.phone,
          location: contact.location,
          links: contact.links,
        },
      });
      await saveTailoredResume(scope, target.id, result);
      refreshed++;
    } catch (err) {
      console.error(
        `[career-agent] tailor failed for target ${target.id}:`,
        err,
      );
      skipped++;
    }
  }

  return { refreshed, skipped };
}
