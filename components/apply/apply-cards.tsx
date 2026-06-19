"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HandMetal,
  Send,
  ChevronDown,
  ChevronRight,
  Shield,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RouteBadge } from "@/components/pipeline/route-badge";
import { recruiterSkimHref } from "@/lib/pipeline/recruiter-skim";
import { GapAnalysisPanel } from "@/components/jobs/gap-analysis-panel";
import { cn } from "@/lib/utils";
import {
  prepareApplicationAction,
  approveSubmitAction,
  takeControlAction,
  resumeAiAction,
} from "@/app/actions/apply";
import type { ApplyState, PreparedField } from "@/lib/apply/types";
import type { ApplicationRowView } from "@/lib/apply/service";
import type { JobView } from "@/lib/jobs/pipeline";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

const STATE_VARIANT: Record<
  ApplyState,
  "muted" | "default" | "warning" | "success" | "danger" | "accent"
> = {
  QUEUED: "muted",
  PREPARING: "muted",
  REVIEW: "warning",
  SUBMITTING: "accent",
  SUBMITTED: "success",
  FAILED: "danger",
  PAUSED: "warning",
  HANDOFF: "accent",
};

export function StateBadge({ state }: { state: ApplyState }) {
  return <Badge variant={STATE_VARIANT[state]}>{state}</Badge>;
}

export function ReviewGate({
  fields,
  readOnly = false,
}: {
  fields: PreparedField[];
  readOnly?: boolean;
}) {
  if (fields.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No fields prepared.</p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Field
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Value
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Source
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Conf
            </th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Flags
            </th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f) => (
            <tr
              key={f.key}
              className={cn(
                "border-b border-border last:border-0",
                f.critical && "bg-[var(--warning)]/5",
                f.source === "unknown" && "bg-[var(--danger)]/5",
              )}
            >
              <td className="px-3 py-2 font-medium text-foreground">{f.label}</td>
              <td className="px-3 py-2 text-muted-foreground">
                {f.value !== "" ? (
                  f.value
                ) : (
                  <span className="italic text-[var(--danger)]">unknown</span>
                )}
              </td>
              <td className="px-3 py-2">
                <Badge
                  variant={
                    f.source === "answers"
                      ? "default"
                      : f.source === "profile"
                        ? "accent"
                        : f.source === "derived"
                          ? "muted"
                          : "danger"
                  }
                  className="text-[10px]"
                >
                  {f.source}
                </Badge>
              </td>
              <td className="px-3 py-2 tabular-nums text-muted-foreground">
                {Math.round(f.confidence * 100)}%
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-1">
                  {f.critical && (
                    <Badge variant="warning" className="text-[10px]">
                      critical
                    </Badge>
                  )}
                  {f.freeText && (
                    <Badge variant="muted" className="text-[10px]">
                      free-text
                    </Badge>
                  )}
                  {f.source === "unknown" && (
                    <Badge variant="danger" className="text-[10px]">
                      missing
                    </Badge>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && (
        <p className="border-t border-border bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
          <Shield className="mr-1 inline h-3 w-3 text-[var(--warning)]" />
          Review every field. Critical fields (work auth, salary, clearance)
          require your confirmation. Unknown fields must be filled in manually.
        </p>
      )}
    </div>
  );
}

export function ApplicationCard({
  app,
  compact = false,
  defaultExpanded = false,
}: {
  app: ApplicationRowView;
  compact?: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [localState, setLocalState] = useState<ApplyState>(app.applyState);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const canApprove =
    localState === "REVIEW" && app.route !== null && app.route !== "MANUAL";
  const needsCheckpoint =
    localState === "REVIEW" || localState === "PAUSED" || localState === "HANDOFF";

  function takeControl() {
    setError(null);
    startSubmit(async () => {
      try {
        await takeControlAction(app.id);
        setLocalState("HANDOFF");
        router.refresh();
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  function resumeAi() {
    setError(null);
    startSubmit(async () => {
      try {
        await resumeAiAction(app.id);
        setLocalState("PREPARING");
        router.refresh();
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  function approve() {
    setError(null);
    startSubmit(async () => {
      try {
        const result = await approveSubmitAction(app.id);
        setLocalState(result.state);
        router.refresh();
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-shadow",
        needsCheckpoint && !expanded
          ? "border-[var(--warning)]/40 ring-1 ring-[var(--warning)]/15"
          : "border-border",
        expanded && "shadow-sm",
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          compact ? "p-2.5" : "gap-3 p-4",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "font-medium text-foreground",
                compact ? "text-sm" : "",
              )}
            >
              {app.jobTitle}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {app.company}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {app.route && (
              <RouteBadge route={app.route} size={compact ? "sm" : "default"} />
            )}
            <StateBadge state={localState} />
            {localState === "REVIEW" && !expanded && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warning)]/12 px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
                <Shield className="h-3 w-3" />
                checkpoint
              </span>
            )}
            {app.submittedAt && !compact && (
              <span className="text-xs text-muted-foreground">
                Submitted {new Date(app.submittedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {app.knockouts?.disqualified && (
        <div className="border-t border-border bg-[var(--danger)]/8 px-3 py-2">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--danger)]">
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            Disqualified
          </div>
        </div>
      )}

      {app.detection && !app.detection.clean && !expanded && (
        <div className="border-t border-border bg-[var(--warning)]/8 px-3 py-1.5 text-[10px] text-[var(--warning)]">
          Autonomy blocked
        </div>
      )}

      {expanded && (
        <div className={cn("border-t border-border", compact ? "px-3 py-3" : "px-4 py-4")}>
          {app.detection && !app.detection.clean && (
            <div className="mb-3 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/8 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--warning)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Detection issues - autonomy blocked
              </div>
              <ul className="mt-1 space-y-0.5">
                {app.detection.signals.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(localState === "REVIEW" ||
            localState === "PREPARING" ||
            localState === "PAUSED" ||
            localState === "HANDOFF") && (
            <div className="mb-3 flex flex-wrap gap-2">
              {localState !== "HANDOFF" && (
                <Button size="sm" variant="outline" onClick={takeControl} disabled={submitting}>
                  <HandMetal className="h-3.5 w-3.5" /> Take control
                </Button>
              )}
              {(localState === "HANDOFF" || localState === "PAUSED") && (
                <Button size="sm" variant="accent" onClick={resumeAi} disabled={submitting}>
                  Resume AI
                </Button>
              )}
            </div>
          )}

          {localState === "PAUSED" && (
            <div className="mb-3 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/8 p-3 text-xs text-[var(--warning)]">
              CAPTCHA detected - automation paused. Solve it in the browser, then click Resume AI.
            </div>
          )}

          {app.routeReasons && app.routeReasons.length > 0 && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Routing reasons</p>
              <ul className="space-y-0.5">
                {app.routeReasons.map((r, i) => (
                  <li key={i} className="text-xs text-muted-foreground">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href={recruiterSkimHref(app.company, app.jobTitle)}
            className="mb-3 inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
          >
            Recruiter skim →
          </Link>

          {localState === "REVIEW" && (
            <div className="mb-4 rounded-lg border-2 border-[var(--warning)] bg-[var(--warning)]/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
                <Shield className="h-4 w-4" />
                Human approval required
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                No field is submitted without your approval. Check sources and values.
              </p>
              <ReviewGate fields={app.fields} />
            </div>
          )}

          {app.fields.length > 0 && localState !== "REVIEW" && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Prepared fields</p>
              <ReviewGate fields={app.fields} readOnly />
            </div>
          )}

          {localState === "REVIEW" && (
            <div className="mt-3">
              {app.route === "MANUAL" && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/8 p-3 text-xs text-[var(--warning)]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Manual route - apply by hand. Auto-submit is blocked.
                </div>
              )}
              <Button
                onClick={approve}
                disabled={submitting || !canApprove}
                variant={canApprove ? "accent" : "outline"}
                className="w-full sm:w-auto"
                size="sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Approve &amp; submit
                  </>
                )}
              </Button>
            </div>
          )}

          {localState === "SUBMITTED" && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--success)]/10 p-2 text-xs text-[var(--success)]">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              Submitted successfully.
            </div>
          )}

          {localState === "FAILED" && !app.knockouts?.disqualified && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--danger)]/10 p-2 text-xs text-[var(--danger)]">
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              Submit failed.
            </div>
          )}

          {localState === "SUBMITTING" && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--warning)]/10 p-2 text-xs text-[var(--warning)]">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Stuck in SUBMITTING - check employer portal.
            </div>
          )}

          {error && <p className="mt-2 text-xs text-[var(--danger)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

export function QueuedJobRow({
  job,
  resumeText,
  goalText,
  preparing,
  error,
  onPrepare,
  compact = false,
}: {
  job: JobView;
  resumeText: string;
  goalText?: string;
  preparing: boolean;
  error?: string;
  onPrepare: () => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background">
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          compact ? "px-2.5 py-2" : "gap-3 px-3 py-2",
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">{job.title}</span>
            <RouteBadge route={job.routePreview} size="sm" />
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {job.company}
            {job.location ? ` · ${job.location}` : ""}
          </div>
          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {job.description && resumeText && (
            <button
              type="button"
              onClick={() => setExpanded((s) => !s)}
              aria-expanded={expanded}
              aria-label="Gap analysis"
              className="rounded p-1 text-muted-foreground hover:text-foreground"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          <Button size="sm" variant="outline" onClick={onPrepare} disabled={preparing}>
            {preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Prepare
          </Button>
        </div>
      </div>
      {expanded && job.description && resumeText && (
        <div className="border-t border-border px-3 py-3">
          <GapAnalysisPanel
            profileText={resumeText}
            jobDescription={job.description}
            company={job.company}
            roleTitle={job.title}
            goalText={goalText}
          />
        </div>
      )}
    </div>
  );
}

export function usePrepareQueue() {
  const [preparing, setPreparing] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const router = useRouter();

  async function prepare(jobId: string) {
    setPreparing(jobId);
    setErrors((e) => ({ ...e, [jobId]: "" }));
    try {
      await prepareApplicationAction(jobId);
      router.refresh();
    } catch (e) {
      setErrors((prev) => ({ ...prev, [jobId]: msg(e) }));
    } finally {
      setPreparing(null);
    }
  }

  return { preparing, errors, prepare };
}
