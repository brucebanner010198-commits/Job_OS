import { PageHeader } from "@/components/page-header";
import { getJournalDataAction } from "@/app/actions/journal";
import { JournalWorkspace } from "@/components/journal/journal-workspace";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const { logs, candidateBullets } = await getJournalDataAction();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <PageHeader
        title="Career journal & work logger"
        description="Log your daily work, technical decisions, and point of view. Compile turns your logs into draft resume bullets; each one reaches your Master CV only after you approve it."
      />
      <JournalWorkspace initialLogs={logs} initialBullets={candidateBullets} />
    </main>
  );
}
