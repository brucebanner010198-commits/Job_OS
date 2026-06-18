/**
 * Master-profile data service.
 *
 * The single read/write surface over ProfileEntry / ProfileNote rows. Keeps
 * Prisma access in one place and exposes the DB-decoupled ProfileFact shape to
 * generators (resume, cover letter, etc.).
 */
import { db } from "@/lib/db";
import { ProfileEntryKind, type ProfileEntry } from "@prisma/client";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import type { ProfileFact } from "@/lib/profile/types";
import { needsPolish } from "@/lib/profile/polish";

/** All profile entries for the active profile, ordered by kind then creation time. */
export async function listFacts(scope: AppScope): Promise<ProfileEntry[]> {
  return db.profileEntry.findMany({
    where: scopeWhere(scope),
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
  });
}

/** Map DB rows to the decoupled ProfileFact shape used by generators. */
export function toFacts(entries: ProfileEntry[]): ProfileFact[] {
  return entries.map((e) => ({
    id: e.id,
    kind: e.kind,
    data: e.data,
    sourceNote: e.sourceNote,
    sensitive: e.sensitive,
  }));
}

/**
 * Bulk-insert profile entries. Returns the number of rows created.
 * `data` is cast to any because Prisma's Json column accepts arbitrary JSON.
 */
export async function addEntries(
  scope: AppScope,
  entries: {
    kind: ProfileEntryKind;
    data: unknown;
    sourceNote?: string;
    sensitive?: boolean;
  }[],
): Promise<number> {
  if (entries.length === 0) return 0;
  const result = await db.profileEntry.createMany({
    data: entries.map((e) => ({
      ...scopeData(scope),
      kind: e.kind,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: e.data as any,
      sourceNote: e.sourceNote ?? null,
      sensitive: e.sensitive ?? false,
    })),
  });
  return result.count;
}

/** Recent profile notes for setup flags and provenance checks. */
export async function listNotes(
  scope: AppScope,
  options?: { sources?: string[]; limit?: number },
): Promise<{ source: string; rawText: string }[]> {
  return db.profileNote.findMany({
    where: {
      ...scopeWhere(scope),
      ...(options?.sources?.length ? { source: { in: options.sources } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options?.limit ?? 100,
    select: { source: true, rawText: true },
  });
}

/** Persist a raw (and optionally cleaned) capture note. */
export async function saveNote(
  scope: AppScope,
  rawText: string,
  cleanedText: string | null,
  source: string,
): Promise<void> {
  await db.profileNote.create({
    data: { ...scopeData(scope), rawText, cleanedText, source },
  });
}

/**
 * Best-effort contact block for the profile: the latest CONTACT entry's data
 * merged under the user's own name/email. Defensive about the JSON shape since
 * ProfileEntry.data is unknown.
 */
export async function getContact(scope: AppScope): Promise<{
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
}> {
  const [user, contact] = await Promise.all([
    db.user.findUnique({ where: { id: scope.userId } }),
    db.profileEntry.findFirst({
      where: { ...scopeWhere(scope), kind: ProfileEntryKind.CONTACT },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const out: {
    name?: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  } = {};

  if (contact && typeof contact.data === "object" && contact.data !== null) {
    const d = contact.data as Record<string, unknown>;
    if (typeof d.name === "string") out.name = d.name;
    if (typeof d.email === "string") out.email = d.email;
    if (typeof d.phone === "string") out.phone = d.phone;
    if (typeof d.location === "string") out.location = d.location;
    if (Array.isArray(d.links)) {
      const links = d.links.filter((l): l is string => typeof l === "string");
      if (links.length > 0) out.links = links;
    }
  }

  if (user) {
    if (!out.name && user.name) out.name = user.name;
    if (!out.email && user.email) out.email = user.email;
  }

  return out;
}

/** Update a single profile entry's structured data payload. */
export async function updateEntry(
  scope: AppScope,
  entryId: string,
  data: unknown,
): Promise<void> {
  await db.profileEntry.update({
    where: { id: entryId, ...scopeWhere(scope) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { data: data as any },
  });
}

/** EXPERIENCE/PROJECT entries that still need framework polish. */
export async function listEntriesNeedingPolish(
  scope: AppScope,
): Promise<ProfileEntry[]> {
  const entries = await db.profileEntry.findMany({
    where: {
      ...scopeWhere(scope),
      sensitive: false,
      kind: { in: [ProfileEntryKind.EXPERIENCE, ProfileEntryKind.PROJECT] },
    },
    orderBy: { updatedAt: "asc" },
  });
  return entries.filter(needsPolish);
}

/** Latest profile change time across non-sensitive entries (content watermark). */
export async function getProfileContentWatermark(
  scope: AppScope,
): Promise<Date | null> {
  const result = await db.profileEntry.aggregate({
    where: { ...scopeWhere(scope), sensitive: false },
    _max: { updatedAt: true },
  });
  return result._max.updatedAt;
}
