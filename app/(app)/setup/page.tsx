import Link from "next/link";
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { getSetupStatus, type SetupStatus } from "@/lib/pipeline/setup-status";
import { getGoal, nonSensitiveProfileText } from "@/lib/goals/service";
import { SetupWizard } from "@/components/pipeline/setup-wizard";
import { SetupCompletePanel } from "@/components/pipeline/setup-complete-panel";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DbBanner } from "@/components/db-banner";
import { SystemReadiness } from "@/components/system-readiness";
import type { CareerGoalData } from "@/lib/goals/types";

export const dynamic = "force-dynamic";

const EMPTY_SETUP: SetupStatus = {
  hasResume: false,
  hasGoals: false,
  resumeCount: 0,
  setupPartial: false,
  complete: false,
};

interface SetupPageData {
  setup: SetupStatus;
  goal: CareerGoalData | null;
  resumeText: string;
}

export default async function SetupPage() {
  const { data, dbError } = await safeDb<SetupPageData>(async () => {
    const { scope } = await getAppContext();
    const [setup, goal, resumeText] = await Promise.all([
      getSetupStatus(scope),
      getGoal(scope),
      nonSensitiveProfileText(scope),
    ]);
    return { setup, goal, resumeText };
  }, { setup: EMPTY_SETUP, goal: null, resumeText: "" });

  const { setup } = data;
  const initialStep = !setup.hasResume ? 1 : !setup.hasGoals ? 3 : 4;

  return (
    <main className="page-container max-w-3xl">
      {dbError && <DbBanner />}

      <PageHeader
        title="Setup"
        description={
          setup.complete
            ? "Your profile is ready — autopilot is handling discovery and preparation."
            : "Choose your path, share your background, coach through gaps, and confirm your profile."
        }
        action={
          setup.complete ? (
            setup.setupPartial ? (
              <Badge variant="warning">Partial setup</Badge>
            ) : (
              <Badge variant="success">Ready for autopilot</Badge>
            )
          ) : (
            <Badge variant="warning">In progress</Badge>
          )
        }
      />

      {setup.complete ? (
        <SetupCompletePanel setup={setup} />
      ) : (
        <>
          <SetupWizard
            resumeDone={setup.hasResume}
            goalsDone={setup.hasGoals}
            resumeCount={setup.resumeCount}
            initialGoal={data.goal}
            resumeText={data.resumeText}
            initialStep={initialStep}
          />

          <div className="mt-8">
            <SystemReadiness compact />
          </div>

          <div className="mt-4 surface-card p-5">
            <h2 className="font-medium">Ready check</h2>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className={setup.hasResume ? "text-success" : "text-muted-foreground/50"}>
                  {setup.hasResume ? "✓" : "○"}
                </span>
                Resume {setup.hasResume && `(${setup.resumeCount} entries)`}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className={setup.hasGoals ? "text-success" : "text-muted-foreground/50"}>
                  {setup.hasGoals ? "✓" : "○"}
                </span>
                Career goals saved
                {setup.setupPartial && setup.hasGoals && (
                  <span className="text-xs text-[var(--warning)]">(coaching skipped)</span>
                )}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="text-muted-foreground/50">○</span>
                Integrations <span className="text-xs">(optional)</span>
              </li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link href="/integrations">
                <Button variant="outline">Set up integrations</Button>
              </Link>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
