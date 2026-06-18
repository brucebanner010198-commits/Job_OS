/**
 * Server-only persistence for the dream company board.
 * Pure helpers live in dream-companies.ts for client components.
 */
import "server-only";

import { db } from "@/lib/db";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData } from "@/lib/profiles/scope";
import {
  DREAM_COMPANIES_SOURCE,
  parseDreamCompaniesJson,
  serializeDreamCompanies,
  type DreamCompany,
} from "@/lib/goals/dream-companies";

export async function getDreamCompanies(scope: AppScope): Promise<DreamCompany[]> {
  const note = await db.profileNote.findFirst({
    where: { profileId: scope.profileId, source: DREAM_COMPANIES_SOURCE },
    orderBy: { createdAt: "desc" },
  });
  if (!note) return [];
  return parseDreamCompaniesJson(note.rawText);
}

export async function saveDreamCompanies(
  scope: AppScope,
  companies: DreamCompany[],
): Promise<void> {
  const raw = serializeDreamCompanies(companies);
  const existing = await db.profileNote.findFirst({
    where: { profileId: scope.profileId, source: DREAM_COMPANIES_SOURCE },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await db.profileNote.update({
      where: { id: existing.id },
      data: { rawText: raw, cleanedText: raw },
    });
    return;
  }

  await db.profileNote.create({
    data: {
      ...scopeData(scope),
      rawText: raw,
      cleanedText: raw,
      source: DREAM_COMPANIES_SOURCE,
    },
  });
}
