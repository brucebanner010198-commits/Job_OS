/**
 * Outcomes & Automation page (Phase 9, plan §9) - the last surface, and the one
 * that judges all the others. Two sections:
 *
 *   A. Outcomes - the KPI that actually matters: interviews per 10 SUBMITTED
 *      applications (and offers), split by LANE (cold vs warm) so a lane that
 *      isn't converting is flagged, plus speed-to-apply (the ~8× lever) and a
 *      lead "do this next" list. "Measure outcomes, not activity."
 *
 *   B. Automation - the honest local-first scheduler: a launchd catch-up runner
 *      that re-runs only what's DUE since it last ran, idempotently, whenever the
 *      machine is awake (with an optional Gmail push relay as the one cloud
 *      piece). The page hands you the exact plist + install commands.
 *
 * Server component: both halves load through safeDb and ALWAYS fall back to a
 * pure offline preview (previewMetrics / previewOps) when Postgres is unreachable
 * or there's no pipeline yet, so the dashboard renders identically with no DB.
 */
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { Badge } from "@/components/ui/badge";
import { getMetricsView, previewMetrics } from "@/lib/metrics/service";
import { getOpsView, previewOps } from "@/lib/scheduler/service";
import { HeadlineStats } from "@/components/outcomes/headline-stats";
import { FunnelBar } from "@/components/outcomes/funnel-bar";
import { LaneTable } from "@/components/outcomes/lane-table";
import { Recommendations } from "@/components/outcomes/recommendations";
import { LearningsFeed } from "@/components/outcomes/learnings-feed";
import { AutomationPanel } from "@/components/outcomes/automation-panel";
import {
  listRejectionLearnings,
  previewRejectionLearnings,
} from "@/lib/track/learnings-view";
import type { RejectionLearningView } from "@/lib/track/learnings-view";
import type { MetricsView } from "@/lib/metrics/types";
import type { OpsView } from "@/lib/scheduler/types";

export const dynamic = "force-dynamic";

export default async function OutcomesPage() {
  const { scope } = await getAppContext();

  const metricsRes = await safeDb<MetricsView | null>(async () => {
    return getMetricsView(scope);
  }, null);

  const learningsRes = await safeDb<RejectionLearningView[]>(
    async () => listRejectionLearnings(scope),
    [],
  );

  const opsRes = await safeDb<OpsView | null>(async () => {
    return getOpsView(scope);
  }, null);

  const usePreview =
    metricsRes.dbError ||
    !metricsRes.data ||
    metricsRes.data.funnel.applied === 0;
  const metrics: MetricsView = usePreview
    ? previewMetrics()
    : (metricsRes.data as MetricsView);

  const ops: OpsView =
    opsRes.dbError || !opsRes.data ? previewOps() : (opsRes.data as OpsView);

  const useLearningsPreview =
    learningsRes.dbError || learningsRes.data.length === 0;
  const learnings: RejectionLearningView[] = useLearningsPreview
    ? previewRejectionLearnings()
    : learningsRes.data;

  const { practice } = metrics;

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Outcomes &amp; automation
          </h1>
          {usePreview ? (
            <Badge variant="muted" className="text-[10px]">
              sample preview
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">
              live data
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Track interviews per 10 submitted applications across cold and warm
          routes. Use conversion by lane to prioritize outreach. Scheduled
          background jobs keep Gmail sync, discovery, and follow-ups current
          while your machine is active.
        </p>
      </header>

      {metricsRes.dbError && <DbBanner />}

      <section className="mb-12 space-y-6">
        <Recommendations items={metrics.recommendations} />

        <HeadlineStats headline={metrics.headline} speed={metrics.speed} />

        <FunnelBar funnel={metrics.funnel} />

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Conversion by lane
            </h2>
            <Badge variant="outline" className="text-[10px]">
              cold vs warm
            </Badge>
          </div>
          <LaneTable lanes={metrics.lanes} />
        </div>

        {practice.sessions > 0 && (
          <p className="text-xs text-muted-foreground">
            Interview practice: {practice.sessions} session
            {practice.sessions === 1 ? "" : "s"} run
            {practice.liveSessions > 0 && ` · ${practice.liveSessions} live`}
            {practice.avgScore !== undefined &&
              ` · avg score ${practice.avgScore}/100`}
            .
          </p>
        )}

        <LearningsFeed items={learnings} preview={useLearningsPreview} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Background automation
          </h2>
          <Badge variant="accent" className="text-[10px]">
            scheduled locally
          </Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Recurring jobs run on interval and when your Mac wakes. Each job runs
          once per due window. Install the launchd agent below to enable
          automatic execution. Gmail push relay is optional and off by default.
        </p>
        <AutomationPanel ops={ops} />
      </section>
    </main>
  );
}
