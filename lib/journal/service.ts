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

  const fact = await mergeIntoProfile(scope, kind, bullet.bulletText, bullet.workLogEntry?.project ?? null, provenanceNote);

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

const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Puts an approved bullet where the resume shows it: under the matching job
 * (by company or title, else the most recent role), or into the skills group.
 * Only when there is nothing to attach to does it create a new entry, in the
 * same shape the resume importer uses. Duplicate bullets are not re-added.
 */
async function mergeIntoProfile(
  scope: AppScope,
  kind: ProfileEntryKind,
  text: string,
  project: string | null,
  sourceNote: string,
) {
  if (kind === ProfileEntryKind.SKILL) {
    const group = await db.profileEntry.findFirst({
      where: { ...scopeWhere(scope), kind: ProfileEntryKind.SKILL },
      orderBy: { createdAt: "asc" },
    });
    const skills = text.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    if (group) {
      const data = group.data as { name?: string; skills?: string[] };
      const existing = new Set((data.skills ?? []).map(normalize));
      const merged = [...(data.skills ?? []), ...skills.filter((x) => !existing.has(normalize(x)))];
      return db.profileEntry.update({ where: { id: group.id }, data: { data: { ...data, skills: merged } } });
    }
    return db.profileEntry.create({
      data: { ...scopeData(scope), kind, data: { name: "Skills", skills }, sourceNote, sensitive: false },
    });
  }

  const roles = await db.profileEntry.findMany({
    where: { ...scopeWhere(scope), kind: ProfileEntryKind.EXPERIENCE },
    orderBy: { createdAt: "desc" },
  });
  const wanted = project ? normalize(project) : "";
  const target =
    (wanted &&
      roles.find((r) => {
        const d = r.data as { company?: string; title?: string };
        return [d.company, d.title].some((v) => v && normalize(v).includes(wanted));
      })) ||
    roles.find((r) => /present|current/i.test(String((r.data as { end?: string }).end ?? ""))) ||
    roles[0];

  if (target) {
    const data = target.data as { bullets?: string[] };
    const bullets = data.bullets ?? [];
    if (bullets.some((b) => normalize(b) === normalize(text))) return target;
    return db.profileEntry.update({
      where: { id: target.id },
      data: { data: { ...data, bullets: [...bullets, text] } },
    });
  }

  return db.profileEntry.create({
    data: {
      ...scopeData(scope),
      kind: ProfileEntryKind.PROJECT,
      data: { name: project ?? "Work journal", bullets: [text] },
      sourceNote,
      sensitive: false,
    },
  });
}
