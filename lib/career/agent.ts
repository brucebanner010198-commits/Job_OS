/**
 * Career content agent - orchestrates polish → tailor → cover letter refresh.
 */
import type { AppScope } from "@/lib/profiles/types";
import { scopeWhere } from "@/lib/profiles/scope";
import { db } from "@/lib/db";
import { getProfileContentWatermark } from "@/lib/profile/service";
import { polishProfileBullets } from "@/lib/profile/polish";
import { refreshTailoredResumes } from "@/lib/resume/service";
import { refreshCoverLetters } from "@/lib/coverletter/service";

export interface CareerAgentResult {
  polished: number;
  resumes: number;
  coverLetters: number;
  detail: string;
}

export async function runCareerContentAgent(
  scope: AppScope,
): Promise<CareerAgentResult> {
  const entryCount = await db.profileEntry.count({
    where: { ...scopeWhere(scope), sensitive: false },
  });

  if (entryCount === 0) {
    return {
      polished: 0,
      resumes: 0,
      coverLetters: 0,
      detail: "empty profile",
    };
  }

  const { polished } = await polishProfileBullets(scope);
  await getProfileContentWatermark(scope);

  const { refreshed: resumes } = await refreshTailoredResumes(scope);
  const { refreshed: coverLetters } = await refreshCoverLetters(scope);

  const detail = `polished ${polished} bullets, refreshed ${resumes} resumes, ${coverLetters} cover letters`;

  return { polished, resumes, coverLetters, detail };
}
