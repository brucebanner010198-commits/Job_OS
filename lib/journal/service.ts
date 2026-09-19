import { db } from "@/lib/db";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import { Prisma, ProfileEntryKind } from "@prisma/client";
import type { CreateWorkLogInput } from "./types";
import { compileWorkLogsToBullets } from "./compiler";

export async function createWorkLog(scope: AppScope, input: CreateWorkLogInput) {
  return db.workLogEntry.create({
    data: {
      ...scopeData(scope),
      title: input.title,
      project: input.project ?? null,
      tasksDone: input.tasksDone,
      pointOfView: input.pointOfView ?? null,
      category: input.category ?? "FEATURE",
      rawContext: input.rawContext ?? null,
      metrics: (input.metrics as unknown as Prisma.InputJsonValue) ?? [],
      tags: input.tags ?? [],
      date: input.date ? new Date(input.date) : new Date(),
    },
  });
}

export async function listWorkLogs(scope: AppScope) {
  return db.workLogEntry.findMany({
    where: scopeWhere(scope),
    orderBy: { date: "desc" },
    include: { candidateBullets: true },
  });
}

export async function deleteWorkLog(scope: AppScope, id: string) {
  return db.workLogEntry.deleteMany({
    where: {
      id,
      ...scopeWhere(scope),
    },
  });
}

export async function listCandidateBullets(scope: AppScope, approvedOnly = false) {
  return db.candidateBullet.findMany({
    where: {
      ...scopeWhere(scope),
      ...(approvedOnly ? { approved: true } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { workLogEntry: true },
  });
}

/**
 * Compiles all uncompiled daily logs into candidate master resume bullets.
 * Maintains direct backlink provenance to the originating work logs.
 */
export async function compileWeeklyWorkLogs(scope: AppScope) {
  const uncompiledLogs = await db.workLogEntry.findMany({
    where: {
      ...scopeWhere(scope),
      compiled: false,
    },
    orderBy: { date: "asc" },
  });

  if (uncompiledLogs.length === 0) {
    return { compiledCount: 0, bulletsCreated: 0 };
  }

  const compiledBullets = await compileWorkLogsToBullets(uncompiledLogs);

  const createdBullets = [];
  for (const bullet of compiledBullets) {
    const created = await db.candidateBullet.create({
      data: {
        ...scopeData(scope),
        workLogEntryId: bullet.workLogEntryId,
        bulletText: bullet.bulletText,
        impactClaim: bullet.impactClaim,
        suggestedKind: bullet.suggestedKind,
        approved: false,
      },
    });
    createdBullets.push(created);
  }

  // Mark processed logs as compiled
  const logIds = uncompiledLogs.map((l) => l.id);
  await db.workLogEntry.updateMany({
    where: { id: { in: logIds } },
    data: { compiled: true },
  });

  return {
    compiledCount: uncompiledLogs.length,
    bulletsCreated: createdBullets.length,
    bullets: createdBullets,
  };
}

/**
 * Human approval gate: Promotes a candidate bullet into a permanent ProfileEntry fact
 * on the Master Resume, preserving provenance.
 */
export async function approveCandidateBullet(scope: AppScope, bulletId: string) {
  const bullet = await db.candidateBullet.findFirst({
    where: {
      id: bulletId,
      ...scopeWhere(scope),
    },
    include: { workLogEntry: true },
  });

  if (!bullet) {
    throw new Error("Candidate bullet not found.");
  }

  if (bullet.approved && bullet.profileEntryId) {
    return { alreadyApproved: true, profileEntryId: bullet.profileEntryId };
  }

  const kind = (ProfileEntryKind[bullet.suggestedKind as keyof typeof ProfileEntryKind] ||
    ProfileEntryKind.EXPERIENCE) as ProfileEntryKind;

  const provenanceNote = bullet.workLogEntry
    ? `Compiled from journal on ${bullet.workLogEntry.date.toISOString().slice(0, 10)}: "${bullet.workLogEntry.title}"`
    : `Compiled from work journal`;

  // Create ProfileEntry fact in the Master Profile
  const fact = await db.profileEntry.create({
    data: {
      ...scopeData(scope),
      kind,
      data: {
        text: bullet.bulletText,
        impact: bullet.impactClaim,
        project: bullet.workLogEntry?.project ?? "General",
        source: "work_journal",
        addedAt: new Date().toISOString(),
      },
      sourceNote: provenanceNote,
      sensitive: false,
    },
  });

  // Mark CandidateBullet as approved with backlink
  await db.candidateBullet.update({
    where: { id: bullet.id },
    data: {
      approved: true,
      profileEntryId: fact.id,
    },
  });

  return { success: true, factId: fact.id };
}
