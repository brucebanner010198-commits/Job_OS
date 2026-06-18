import type { AppScope } from "@/lib/profiles/types";
import { ensureDefaultProfile } from "@/lib/profiles/service";

/** Prisma `where` fragment for profile-scoped rows. */
export function scopeWhere(scope: AppScope) {
  return { userId: scope.userId, profileId: scope.profileId };
}

/** Spread into Prisma `create` payloads. */
export function scopeData(scope: AppScope) {
  return { userId: scope.userId, profileId: scope.profileId };
}

/** Accept legacy userId strings in scripts/tests; resolves Default profile. */
export async function resolveScope(input: AppScope | string): Promise<AppScope> {
  if (typeof input !== "string") return input;
  const profile = await ensureDefaultProfile(input);
  return { userId: input, profileId: profile.id };
}
