/**
 * Career-goal data service. Single read/write surface over the CareerGoal row,
 * exposing the DB-decoupled CareerGoalData shape and the goal scoring axis.
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { listFacts, toFacts } from "@/lib/profile/service";
import { nonSensitive } from "@/lib/ai/redaction";
import { flattenFact } from "@/lib/profile/types";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData } from "@/lib/profiles/scope";
import {
  type CareerGoalData,
  type Milestone,
  normalizeMilestones,
} from "./types";

/**
 * Flattened, non-sensitive master profile as one text blob. Used both as the
 * resume scoring axis (the "where you've been" side of relevance) and as
 * read-only context for goal elicitation. Sensitive life facts never leave.
 */
export async function nonSensitiveProfileText(scope: AppScope): Promise<string> {
  const entries = await listFacts(scope);
  return toFacts(nonSensitive(entries)).map(flattenFact).join("\n");
}

/** Read the profile's goals (singleton), normalized to all seven horizons. */
export async function getGoal(scope: AppScope): Promise<CareerGoalData | null> {
  const row = await db.careerGoal.findUnique({ where: { profileId: scope.profileId } });
  if (!row) return null;
  return {
    northStar: row.northStar,
    summary: row.summary,
    targetTitles: row.targetTitles,
    targetIndustries: row.targetIndustries,
    milestones: normalizeMilestones(
      Array.isArray(row.milestones)
        ? (row.milestones as unknown as Milestone[])
        : [],
    ),
  };
}

/** Create or replace the profile's goals. `rawNote` keeps provenance. */
export async function upsertGoal(
  scope: AppScope,
  data: CareerGoalData,
  rawNote: string | null,
): Promise<void> {
  const milestones = normalizeMilestones(data.milestones).filter((m) =>
    m.text.trim(),
  ) as unknown as Prisma.InputJsonValue;

  const fields = {
    northStar: data.northStar,
    summary: data.summary,
    targetTitles: data.targetTitles,
    targetIndustries: data.targetIndustries,
    milestones,
    rawNote,
  };

  await db.careerGoal.upsert({
    where: { profileId: scope.profileId },
    create: { ...scopeData(scope), ...fields },
    update: fields,
  });
}
