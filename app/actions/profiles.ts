"use server";

import { revalidatePath } from "next/cache";
import {
  requireAccessForMutation,
  requireAccessForRead,
} from "@/lib/auth/require-access";
import { getPrimaryUser } from "@/lib/user";
import {
  createProfile,
  deleteProfile,
  getProfileById,
  listProfiles,
} from "@/lib/profiles/service";
import { getAppContext, setActiveProfileCookie } from "@/lib/app-context";
import {
  createProfileSchema,
  deleteProfileSchema,
  parseActionInput,
} from "@/lib/validation/action-schemas";

export type ProfileSummary = { id: string; name: string };

export async function listProfilesAction(): Promise<ProfileSummary[]> {
  await requireAccessForRead();
  const user = await getPrimaryUser();
  const profiles = await listProfiles(user.id);
  return profiles.map((p) => ({ id: p.id, name: p.name }));
}

export async function getActiveProfileAction(): Promise<ProfileSummary> {
  await requireAccessForRead();
  const { profile } = await getAppContext();
  return { id: profile.id, name: profile.name };
}

export async function switchProfileAction(profileId: string): Promise<void> {
  await requireAccessForMutation();
  const user = await getPrimaryUser();
  const profile = await getProfileById(user.id, profileId);
  if (!profile) throw new Error("Profile not found.");
  await setActiveProfileCookie(profileId);
  revalidatePath("/", "layout");
}

export async function createProfileAction(name: string): Promise<ProfileSummary> {
  await requireAccessForMutation();
  const { name: profileName } = parseActionInput(createProfileSchema, { name });
  const user = await getPrimaryUser();
  const profile = await createProfile(user.id, profileName);
  await setActiveProfileCookie(profile.id);
  revalidatePath("/", "layout");
  return { id: profile.id, name: profile.name };
}

export async function deleteProfileAction(profileId: string): Promise<void> {
  await requireAccessForMutation();
  const { profileId: id } = parseActionInput(deleteProfileSchema, { profileId });
  const { scope, profile } = await getAppContext();
  await deleteProfile(scope.userId, id);

  if (profile.id === id) {
    const remaining = await listProfiles(scope.userId);
    const next = remaining[0];
    if (next) await setActiveProfileCookie(next.id);
  }

  revalidatePath("/", "layout");
}
