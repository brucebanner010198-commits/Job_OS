/**
 * Multi-profile CRUD. Profiles are named identities within one local install;
 * career data is scoped per profile. API keys / integrations stay per-install.
 */
import { db } from "@/lib/db";
import type { Profile } from "@prisma/client";
import { DEFAULT_PROFILE_NAME } from "@/lib/profiles/constants";

export async function listProfiles(userId: string): Promise<Profile[]> {
  return db.profile.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
  });
}

export async function getProfileById(
  userId: string,
  profileId: string,
): Promise<Profile | null> {
  return db.profile.findFirst({
    where: { id: profileId, userId },
  });
}

export async function getProfileByName(
  userId: string,
  name: string,
): Promise<Profile | null> {
  return db.profile.findUnique({
    where: { userId_name: { userId, name } },
  });
}

/** Create the Default profile when none exist; otherwise return the first profile. */
export async function ensureDefaultProfile(userId: string): Promise<Profile> {
  const existing = await db.profile.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  try {
    return await db.profile.create({
      data: { userId, name: DEFAULT_PROFILE_NAME },
    });
  } catch {
    // Concurrent first-load requests can race on @@unique([userId, name]).
    const retry = await db.profile.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
    if (retry) return retry;
    throw new Error("Could not create or load the default profile.");
  }
}

export async function createProfile(
  userId: string,
  name: string,
): Promise<Profile> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Profile name is required.");
  if (trimmed.length > 64) throw new Error("Profile name must be 64 characters or fewer.");

  const clash = await getProfileByName(userId, trimmed);
  if (clash) throw new Error(`A profile named "${trimmed}" already exists.`);

  return db.profile.create({
    data: { userId, name: trimmed },
  });
}

/**
 * Delete a profile and all scoped career data (cascade). Refuses to delete the
 * last remaining profile or the Default profile when others exist.
 */
export async function deleteProfile(
  userId: string,
  profileId: string,
): Promise<void> {
  const profiles = await listProfiles(userId);
  if (profiles.length <= 1) {
    throw new Error("Cannot delete the only profile.");
  }

  const target = profiles.find((p) => p.id === profileId);
  if (!target) throw new Error("Profile not found.");

  await db.profile.delete({ where: { id: profileId } });
}
