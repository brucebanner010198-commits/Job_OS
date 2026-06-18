/**
 * Multi-profile isolation tests. Requires DATABASE_URL.
 * Run: npm run test:profiles
 */
import { db } from "@/lib/db";
import { getPrimaryUser } from "@/lib/user";
import {
  createProfile,
  deleteProfile,
  ensureDefaultProfile,
  getProfileById,
  listProfiles,
} from "@/lib/profiles/service";
import { scopeData } from "@/lib/profiles/scope";
import { addEntries } from "@/lib/profile/service";
import { ProfileEntryKind } from "@prisma/client";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function main(): Promise<void> {
  console.log("\nprofiles - CRUD + data isolation:\n");

  const user = await getPrimaryUser();
  const defaultProfile = await ensureDefaultProfile(user.id);
  check("ensureDefaultProfile returns a profile", Boolean(defaultProfile.id));

  const testName = `Test-${Date.now()}`;
  const second = await createProfile(user.id, testName);
  check("createProfile succeeds", second.name === testName);

  const all = await listProfiles(user.id);
  check("listProfiles includes both", all.length >= 2);

  const scopeA = { userId: user.id, profileId: defaultProfile.id };
  const scopeB = { userId: user.id, profileId: second.id };

  await addEntries(scopeA, [
    {
      kind: ProfileEntryKind.SKILL,
      data: { name: "isolation-marker-a" },
      sourceNote: "test-profiles",
    },
  ]);
  await addEntries(scopeB, [
    {
      kind: ProfileEntryKind.SKILL,
      data: { name: "isolation-marker-b" },
      sourceNote: "test-profiles",
    },
  ]);

  const entriesA = await db.profileEntry.findMany({
    where: { ...scopeData(scopeA), kind: ProfileEntryKind.SKILL },
  });
  const entriesB = await db.profileEntry.findMany({
    where: { ...scopeData(scopeB), kind: ProfileEntryKind.SKILL },
  });

  const hasA = entriesA.some(
    (e) =>
      typeof e.data === "object" &&
      e.data !== null &&
      (e.data as { name?: string }).name === "isolation-marker-a",
  );
  const hasB = entriesB.some(
    (e) =>
      typeof e.data === "object" &&
      e.data !== null &&
      (e.data as { name?: string }).name === "isolation-marker-b",
  );
  const crossLeakA = entriesA.some(
    (e) =>
      typeof e.data === "object" &&
      e.data !== null &&
      (e.data as { name?: string }).name === "isolation-marker-b",
  );
  const crossLeakB = entriesB.some(
    (e) =>
      typeof e.data === "object" &&
      e.data !== null &&
      (e.data as { name?: string }).name === "isolation-marker-a",
  );

  check("profile A has its marker", hasA);
  check("profile B has its marker", hasB);
  check("profile A does not see B marker", !crossLeakA);
  check("profile B does not see A marker", !crossLeakB);

  await deleteProfile(user.id, second.id);
  const gone = await getProfileById(user.id, second.id);
  check("deleteProfile removes profile", gone === null);

  await db.profileEntry.deleteMany({
    where: {
      userId: user.id,
      profileId: defaultProfile.id,
      sourceNote: "test-profiles",
    },
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
