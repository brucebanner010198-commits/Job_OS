import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { listQueue, listFiltered, previewQueue } from "@/lib/jobs/service";
import { getGoal, nonSensitiveProfileText } from "@/lib/goals/service";
import { goalText } from "@/lib/goals/types";
import { DbBanner } from "@/components/db-banner";
import { JobsQueue } from "@/components/jobs/jobs-queue";
import { PageHeader } from "@/components/page-header";
import type { JobView, FilteredView } from "@/lib/jobs/pipeline";
import type { ScreenResult } from "@/lib/jobs/types";

export const dynamic = "force-dynamic";

interface Loaded {
  queue: JobView[];
  filtered: FilteredView[];
  resumeText: string;
  gt: string;
  stats: ScreenResult["stats"] | null;
}

const FALLBACK: Loaded = {
  queue: [],
  filtered: [],
  resumeText: "",
  gt: "",
  stats: null,
};

export default async function JobsPage() {
  const now = new Date();

  const { data, dbError } = await safeDb<Loaded>(async () => {
    const { scope } = await getAppContext();
    const [queue, filtered, resumeText, goal] = await Promise.all([
      listQueue(scope),
      listFiltered(scope),
      nonSensitiveProfileText(scope),
      getGoal(scope),
    ]);
    const gt = goal ? goalText(goal) : "";
    return { queue, filtered, resumeText, gt, stats: null };
  }, FALLBACK);

  // Degrade to offline fixture preview when DB is unavailable or queue is empty.
  let finalQueue = data.queue;
  let finalFiltered = data.filtered;
  let finalStats = data.stats;
  let isPreview = false;

  if (dbError || data.queue.length === 0) {
    isPreview = true;
    const preview = previewQueue({
      resumeText: data.resumeText,
      goalText: data.gt,
      profileText: data.resumeText,
      now,
    });
    finalQueue = preview.queue;
    finalFiltered = preview.filtered;
    finalStats = preview.stats;
  }

  return (
    <main className="page-container">
      <PageHeader
        title="Job queue"
        description="Find, screen, and score jobs matched to your profile. Expand any row to see why it ranked where it did."
      />

      {dbError && <DbBanner />}

      <JobsQueue
        queue={finalQueue}
        filtered={finalFiltered}
        isPreview={isPreview}
        stats={finalStats}
        resumeText={data.resumeText}
        goalText={data.gt}
      />
    </main>
  );
}
