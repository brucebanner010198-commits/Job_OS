/**
 * Cover letter persistence + background refresh for the career content agent.
 */
import type { CoverLetter } from "@prisma/client";
import { db } from "@/lib/db";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import { getProfileContentWatermark } from "@/lib/profile/service";
import { isTargetCoverStale } from "@/lib/career/staleness";
import {
  generateCoverLetter,
  type CoverLetterResult,
} from "@/lib/coverletter/generate";
import { loadTargetContext, maxTargetsPerRun } from "@/lib/resume/service";

export async function saveCoverLetter(
  scope: AppScope,
  targetId: string,
  result: CoverLetterResult,
): Promise<string> {
  const saved = await db.coverLetter.create({
    data: {
      ...scopeData(scope),
      targetId,
      body: result.body,
      wordCount: result.wordCount,
      provenanceOk: result.provenanceOk,
    },
  });
  return saved.id;
}

export async function getLatestCoverLetter(
  targetId: string,
): Promise<CoverLetter | null> {
  return db.coverLetter.findFirst({
    where: { targetId },
    orderBy: { createdAt: "desc" },
  });
}

export async function refreshCoverLetters(
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
    const latest = await getLatestCoverLetter(target.id);
    if (!isTargetCoverStale(profileWatermark, latest)) {
      skipped++;
      continue;
    }

    try {
      const { user, facts, contact } = await loadTargetContext(
        scope,
        target.id,
      );
      const result = await generateCoverLetter({
        facts,
        jobTitle: target.title,
        company: target.company,
        jobDescription: target.jobDescription,
        contactName: contact.name ?? user.name ?? user.email,
      });
      await saveCoverLetter(scope, target.id, result);
      refreshed++;
    } catch (err) {
      console.error(
        `[career-agent] cover letter failed for target ${target.id}:`,
        err,
      );
      skipped++;
    }
  }

  return { refreshed, skipped };
}
