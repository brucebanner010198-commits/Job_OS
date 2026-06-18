import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { getGoal, nonSensitiveProfileText } from "@/lib/goals/service";
import { getDreamCompanies } from "@/lib/goals/dream-companies-store";
import { DbBanner } from "@/components/db-banner";
import { GoalsWorkspace } from "@/components/goals/goals-workspace";
import { DreamCompanyBoard } from "@/components/goals/dream-company-board";
import type { CareerGoalData } from "@/lib/goals/types";
import type { DreamCompany } from "@/lib/goals/dream-companies";

export const dynamic = "force-dynamic";

interface Loaded {
  goal: CareerGoalData | null;
  resumeText: string;
  dreamCompanies: DreamCompany[];
}

export default async function GoalsPage() {
  const { data, dbError } = await safeDb<Loaded>(async () => {
    const { scope } = await getAppContext();
    const [goal, resumeText, dreamCompanies] = await Promise.all([
      getGoal(scope),
      nonSensitiveProfileText(scope),
      getDreamCompanies(scope),
    ]);
    return { goal, resumeText, dreamCompanies };
  }, { goal: null, resumeText: "", dreamCompanies: [] });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Career goals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your long-term goal plus milestones from 6 months to 10 years. Say or
          type where you want to go, and the app organizes it. Your goals then
          re-rank which jobs show up, so you see roles that fit where you are
          headed, not just where you have been.
        </p>
      </header>
      {dbError && <DbBanner />}
      <GoalsWorkspace initialGoal={data.goal} resumeText={data.resumeText} />
      <DreamCompanyBoard initialCompanies={data.dreamCompanies} goal={data.goal} />
    </main>
  );
}
