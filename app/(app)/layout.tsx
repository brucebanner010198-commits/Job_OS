import { AppShell } from "@/components/app-shell";
import { getAppContextSafe } from "@/lib/app-context";
import { listProfiles } from "@/lib/profiles/service";
import { getSetupStatus, defaultHomeStage } from "@/lib/pipeline/setup-status";

const EMPTY_SETUP = {
  hasResume: false,
  hasGoals: false,
  resumeCount: 0,
  setupPartial: false,
  complete: false,
} as const;

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { scope, profile, dbError } = await getAppContextSafe();

  let profiles = [{ id: profile.id, name: profile.name }];
  let homeStage = defaultHomeStage(EMPTY_SETUP);

  if (!dbError) {
    try {
      const [profileList, setup] = await Promise.all([
        listProfiles(scope.userId),
        getSetupStatus(scope),
      ]);
      profiles = profileList.map((p) => ({ id: p.id, name: p.name }));
      homeStage = defaultHomeStage(setup);
    } catch {
      // Profile list / setup status failed - still render shell with active profile.
    }
  }

  return (
    <AppShell
      profiles={profiles}
      activeProfile={{ id: profile.id, name: profile.name }}
      homeStage={homeStage}
      dbError={dbError}
    >
      {children}
    </AppShell>
  );
}
