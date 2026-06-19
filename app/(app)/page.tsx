import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { DbBanner } from "@/components/db-banner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LiveStatusBadge } from "@/components/live-status-badge";
import { PipelineProgress } from "@/components/pipeline/pipeline-progress";
import { safeDb } from "@/lib/safe";
import { getAppContext } from "@/lib/app-context";
import { getMetricsView, previewMetrics } from "@/lib/metrics/service";
import { autopilotStatus } from "@/lib/autopilot/orchestrator";
import { MODULES } from "@/lib/modules";
import {
  getSetupStatus,
  defaultHomeStage,
  type SetupStatus,
} from "@/lib/pipeline/setup-status";
import { stageById } from "@/lib/pipeline/stages";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const EMPTY_SETUP: SetupStatus = {
  hasResume: false,
  hasGoals: false,
  resumeCount: 0,
  setupPartial: false,
  complete: false,
};

export default async function DashboardPage() {
  const { data: metrics, dbError: metricsError } = await safeDb(async () => {
    const { scope } = await getAppContext();
    return getMetricsView(scope);
  }, previewMetrics());

  const { data: setup, dbError: setupError } = await safeDb(async () => {
    const { scope } = await getAppContext();
    return getSetupStatus(scope);
  }, EMPTY_SETUP);

  const dbError = metricsError || setupError;
  const autopilot = autopilotStatus();
  const homeStage = defaultHomeStage(setup);
  const currentStage = stageById(homeStage);

  const primaryHref = setup.complete ? currentStage.href : "/setup";
  const primaryLabel = setup.complete
    ? `Continue to ${currentStage.label.toLowerCase()}`
    : "Continue setup";

  const adapterNotes = MODULES.filter(
    (m) => m.href && m.liveStatus !== "live",
  );

  return (
    <main className="page-container max-w-2xl py-12 sm:py-16">
      {dbError && <DbBanner />}

      <section className="hero-surface text-center">
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <Badge variant={setup.complete ? "success" : "warning"}>
            {setup.complete
              ? setup.setupPartial
                ? "Setup complete (partial)"
                : currentStage.label
              : "Setup in progress"}
          </Badge>
          <Badge variant={autopilot.enabled ? "accent" : "muted"}>
            {autopilot.enabled ? "Autopilot active" : "Autopilot disabled"}
          </Badge>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {setup.complete ? "Your pipeline is running" : "Complete setup to begin"}
        </h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          {setup.complete
            ? setup.setupPartial
              ? "Your profile is ready, but coaching was skipped — refine goals anytime. Applications are prepared for your review before submission."
              : `You are in ${currentStage.label.toLowerCase()}. Applications are prepared for your review before submission.`
            : "Import your resume and define career goals to activate job discovery and application preparation."}
        </p>

        <div className="mx-auto mt-8 max-w-md">
          <PipelineProgress activeId={homeStage} linked className="mb-2" />
        </div>

        {!setup.complete && (
          <ul className="mx-auto mt-6 max-w-xs space-y-2 text-left text-sm">
            <li
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                setup.hasResume
                  ? "border-success/30 bg-success/5 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                  setup.hasResume
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {setup.hasResume ? <Check className="h-3 w-3" /> : "1"}
              </span>
              Resume imported
              {setup.hasResume && setup.resumeCount > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {setup.resumeCount} entries
                </span>
              )}
            </li>
            <li
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
                setup.hasGoals
                  ? "border-success/30 bg-success/5 text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                  setup.hasGoals
                    ? "bg-success/15 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {setup.hasGoals ? <Check className="h-3 w-3" /> : "2"}
              </span>
              Career goals saved
            </li>
          </ul>
        )}

        {setup.complete && metrics && (
          <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-3">
              <p className="text-xl font-semibold tabular-nums">
                {metrics.funnel.pipeline}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">In pipeline</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-3">
              <p className="text-xl font-semibold tabular-nums">
                {metrics.funnel.applied}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Applied</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/60 px-2 py-3">
              <p className="text-xl font-semibold tabular-nums">
                {metrics.headline.interviewsPer10Apps.toFixed(1)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Interviews per 10 apps</p>
            </div>
          </div>
        )}

        <div className="mt-8">
          <Link href={primaryHref}>
            <Button variant="accent" size="lg" className="min-h-11 gap-2">
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">{autopilot.summary}</p>

        {adapterNotes.length > 0 && (
          <div className="mx-auto mt-8 max-w-md border-t border-border/60 pt-6 text-left">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Adapter status
            </p>
            <ul className="mt-2 space-y-1.5">
              {adapterNotes.map((m) => (
                <li key={m.id}>
                  <Link
                    href={m.href!}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                  >
                    <span>{m.name}</span>
                    <LiveStatusBadge status={m.liveStatus} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
