import type { ProfileEntry } from "@prisma/client";
import { getAppContext } from "@/lib/app-context";
import { listFacts } from "@/lib/profile/service";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { PageHeader } from "@/components/page-header";
import { DictationPanel } from "@/components/master-resume/dictation-panel";
import { MasterResumeWorkspace } from "@/components/master-resume/master-resume-workspace";

export const dynamic = "force-dynamic";

export default async function MasterResumePage() {
  const { data: facts, dbError } = await safeDb<ProfileEntry[]>(async () => {
    const { scope } = await getAppContext();
    return listFacts(scope);
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <PageHeader
        title="Master Resume"
        description="Your single source of truth. Everything else is tailored from here."
      />

      {dbError && <DbBanner />}

      <DictationPanel />

      <MasterResumeWorkspace facts={facts} />
    </main>
  );
}
