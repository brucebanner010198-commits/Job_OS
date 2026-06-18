import { cookies } from "next/headers";
import type { Profile, User } from "@prisma/client";
import { getPrimaryUser } from "@/lib/user";
import {
  DEFAULT_PROFILE_NAME,
  PROFILE_COOKIE,
} from "@/lib/profiles/constants";
import {
  ensureDefaultProfile,
  getProfileById,
} from "@/lib/profiles/service";
import type { AppScope } from "@/lib/profiles/types";

export type { AppScope } from "@/lib/profiles/types";

/** Synthetic ids when Postgres is unreachable - keeps shell renderable offline. */
export const OFFLINE_SCOPE_ID = "__offline__";

export type AppContext = {
  user: User;
  profile: Profile;
  scope: AppScope;
};

export type AppContextResult = AppContext & { dbError: boolean };

/** Resolve active profile from cookie, falling back to Default / first profile. */
export async function resolveActiveProfile(userId: string): Promise<Profile> {
  const jar = await cookies();
  const fromCookie = jar.get(PROFILE_COOKIE)?.value;
  if (fromCookie) {
    const found = await getProfileById(userId, fromCookie);
    if (found) return found;
  }
  return ensureDefaultProfile(userId);
}

/** Primary request context: install user + active named profile. */
export async function getAppContext(): Promise<AppContext> {
  const user = await getPrimaryUser();
  const profile = await resolveActiveProfile(user.id);
  return {
    user,
    profile,
    scope: { userId: user.id, profileId: profile.id },
  };
}

function offlineAppContext(): AppContext {
  const now = new Date();
  const email = process.env.PRIMARY_USER_EMAIL ?? "you@example.com";
  const user: User = {
    id: OFFLINE_SCOPE_ID,
    email,
    name: null,
    createdAt: now,
    updatedAt: now,
  };
  const profile: Profile = {
    id: OFFLINE_SCOPE_ID,
    userId: OFFLINE_SCOPE_ID,
    name: DEFAULT_PROFILE_NAME,
    createdAt: now,
    updatedAt: now,
  };
  return {
    user,
    profile,
    scope: { userId: OFFLINE_SCOPE_ID, profileId: OFFLINE_SCOPE_ID },
  };
}

/**
 * Like getAppContext but never throws - falls back to a Default profile when the
 * database is down so the app shell and dashboard stay visible.
 */
export async function getAppContextSafe(): Promise<AppContextResult> {
  try {
    const ctx = await getAppContext();
    return { ...ctx, dbError: false };
  } catch {
    return { ...offlineAppContext(), dbError: true };
  }
}

/** @deprecated Use getAppContextSafe */
export async function safeGetAppContext(): Promise<{
  context: AppContext | null;
  dbError: boolean;
}> {
  const result = await getAppContextSafe();
  return {
    context: result.dbError ? null : result,
    dbError: result.dbError,
  };
}

/** Fallback profile summary for offline shell when DB is down. */
export const OFFLINE_PROFILE_SUMMARY = {
  id: OFFLINE_SCOPE_ID,
  name: DEFAULT_PROFILE_NAME,
} as const;

/** Set the active profile cookie (server actions / route handlers). */
export async function setActiveProfileCookie(profileId: string): Promise<void> {
  const jar = await cookies();
  jar.set(PROFILE_COOKIE, profileId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
