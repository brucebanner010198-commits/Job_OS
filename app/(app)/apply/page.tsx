import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import {
  getAnswers,
  listApplications,
  previewApply,
} from "@/lib/apply/service";
import type { ApplicationRowView } from "@/lib/apply/service";
import { listQueue } from "@/lib/jobs/service";
import { getGoal, nonSensitiveProfileText } from "@/lib/goals/service";
import { goalText } from "@/lib/goals/types";
import { ApplyWorkspace } from "@/components/apply/apply-workspace";
import { AutopilotPolicyCallout } from "@/components/apply/autopilot-policy-callout";
import { PageHeader } from "@/components/page-header";
import { activeApplyDriverKind } from "@/lib/apply/driver";
import { Badge } from "@/components/ui/badge";
import type { JobView } from "@/lib/jobs/pipeline";
import type { ApplicationAnswersData } from "@/lib/apply/types";

export const dynamic = "force-dynamic";

const DRIVER_BADGE: Record<
  ReturnType<typeof activeApplyDriverKind>,
  { variant: "muted" | "success" | "warning"; label: string }
> = {
  simulated: { variant: "muted", label: "driver: simulated (offline)" },
  playwright: { variant: "success", label: "driver: real Chrome - armed" },
  "playwright(dry-run)": { variant: "warning", label: "driver: real Chrome - dry run" },
};

interface Loaded {
  answers: ApplicationAnswersData;
  applications: ApplicationRowView[];
  queue: JobView[];
  resumeText: string;
  gt: string;
}

export default async function ApplyPage() {
  const { data, dbError } = await safeDb<Loaded>(
    async () => {
      const { scope } = await getAppContext();
      const [answers, applications, queue, resumeText, goal] = await Promise.all([
        getAnswers(scope),
        listApplications(scope),
        listQueue(scope),
        nonSensitiveProfileText(scope),
        getGoal(scope),
      ]);
      return {
        answers,
        applications,
        queue,
        resumeText,
        gt: goal ? goalText(goal) : "",
      };
    },
    {
      answers: { locations: [], customAnswers: [] },
      applications: [],
      queue: [],
      resumeText: "",
      gt: "",
    },
  );

  // previewApply is PURE (no DB) - always runs, even when DB is down
  const preview = previewApply();

  // Which apply driver the current env would use (simulated by default).
  const driverKind = activeApplyDriverKind();

  return (
    <main className="page-container">
      <PageHeader
        title="Apply"
        description="The app prepares each application and you approve it. Every field shows where it came from before you submit."
        action={
          <Badge variant={DRIVER_BADGE[driverKind].variant} className="text-[10px]">
            {DRIVER_BADGE[driverKind].label}
          </Badge>
        }
      />
      {dbError && <DbBanner />}
      <div className="mb-6">
        <AutopilotPolicyCallout />
      </div>
      <ApplyWorkspace
        initialAnswers={data.answers}
        applications={data.applications}
        queue={data.queue}
        preview={preview}
        dbError={dbError}
        resumeText={data.resumeText}
        goalText={data.gt}
      />
    </main>
  );
}
