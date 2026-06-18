"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Save,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ApplyQueueHints } from "@/components/apply/apply-queue-hints";
import { RouteBadge } from "@/components/pipeline/route-badge";
import { recruiterSkimHref } from "@/lib/pipeline/recruiter-skim";
import { GapAnalysisPanel } from "@/components/jobs/gap-analysis-panel";
import { cn } from "@/lib/utils";
import {
  saveAnswersAction,
  prepareApplicationAction,
  approveSubmitAction,
  takeControlAction,
  resumeAiAction,
} from "@/app/actions/apply";
import type {
  ApplicationAnswersData,
  PreparedField,
  KnockoutResult,
  DetectionResult,
  ApplyState,
  ApplyPlan,
} from "@/lib/apply/types";
import type { ApplicationRowView } from "@/lib/apply/service";
import type { JobView } from "@/lib/jobs/pipeline";

// --- Types --------------------------------------------------------------------

interface ApplyWorkspaceProps {
  initialAnswers: ApplicationAnswersData;
  applications: ApplicationRowView[];
  queue: JobView[];
  preview: { plans: { job: string; company: string; plan: ApplyPlan }[] };
  dbError: boolean;
  resumeText?: string;
  goalText?: string;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

// --- Apply state badge --------------------------------------------------------

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

function StateBadge({ state }: { state: ApplyState }) {
  return <Badge variant={STATE_VARIANT[state]}>{state}</Badge>;
}

// --- Itemized review gate table -----------------------------------------------

function ReviewGate({
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
                f.critical &&
                  "bg-[var(--warning)]/5",
                f.source === "unknown" && "bg-[var(--danger)]/5",
              )}
            >
              <td className="px-3 py-2 font-medium text-foreground">
                {f.label}
              </td>
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

// --- Single application card --------------------------------------------------

function ApplicationCard({ app }: { app: ApplicationRowView }) {
  const [expanded, setExpanded] = useState(false);
  const [localState, setLocalState] = useState<ApplyState>(app.applyState);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const canApprove =
    localState === "REVIEW" && app.route !== null && app.route !== "MANUAL";

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
    <div className="rounded-xl border border-border bg-card">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{app.jobTitle}</span>
            <span className="text-sm text-muted-foreground">{app.company}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {app.route && <RouteBadge route={app.route} />}
            <StateBadge state={localState} />
            {app.submittedAt && (
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

      {/* Knockout failures */}
      {app.knockouts?.disqualified && (
        <div className="border-t border-border bg-[var(--danger)]/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--danger)]">
            <XCircle className="h-4 w-4 shrink-0" />
            Disqualified - application blocked
          </div>
          <ul className="mt-1.5 space-y-1">
            {app.knockouts.failures.map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                <span className="font-medium">{f.requirement}:</span> {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detection result (if not clean) */}
      {app.detection && !app.detection.clean && (
        <div className="border-t border-border bg-[var(--warning)]/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--warning)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
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

      {/* Expanded: itemized review gate + approve button */}
      {expanded && (
        <div className="border-t border-border px-4 py-4">
          {/* Cooperative handoff controls */}
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
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Routing reasons
              </p>
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
            Recruiter skim - tailored resume preview →
          </Link>

          {/* Itemized review gate */}
          {localState === "REVIEW" && (
            <div className="mb-4 rounded-lg border-2 border-[var(--warning)] bg-[var(--warning)]/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--warning)]">
                <Shield className="h-4 w-4" />
                Human approval required - review every field before submitting
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                No field is submitted without your approval. Check sources and
                values. Unknown or critical fields must be confirmed.
              </p>
              <ReviewGate fields={app.fields} />
            </div>
          )}

          {app.fields.length > 0 && localState !== "REVIEW" && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Prepared fields
              </p>
              <ReviewGate fields={app.fields} readOnly />
            </div>
          )}

          {/* Approve & Submit button - only enabled at REVIEW and non-MANUAL route */}
          {localState === "REVIEW" && (
            <div className="mt-3">
              {app.route === "MANUAL" && (
                <div className="mb-2 flex items-start gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/8 p-3 text-xs text-[var(--warning)]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Manual route - this job must be applied to by hand (LinkedIn,
                  Workday, or a complex flow). Auto-submit is blocked.
                </div>
              )}
              <Button
                onClick={approve}
                disabled={submitting || !canApprove}
                variant={canApprove ? "accent" : "outline"}
                className="w-full sm:w-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="animate-spin" /> Submitting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Approve &amp; submit (simulated)
                  </>
                )}
              </Button>
              {!canApprove && app.route !== "MANUAL" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Not available in the current state.
                </p>
              )}
            </div>
          )}

          {localState === "SUBMITTED" && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--success)]/10 p-3 text-sm text-[var(--success)]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Submitted successfully (simulated).
            </div>
          )}

          {localState === "FAILED" && !app.knockouts?.disqualified && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              <XCircle className="h-4 w-4 shrink-0" />
              Submit failed. Check the event log or retry from the queue.
            </div>
          )}

          {localState === "SUBMITTING" && (
            <div className="flex items-center gap-2 rounded-lg bg-[var(--warning)]/10 p-3 text-sm text-[var(--warning)]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Stuck in SUBMITTING - manual resolution required. Check the
              employer portal before retrying.
            </div>
          )}

          {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

// --- Preview plan card (read-only, no DB) -------------------------------------

function PreviewPlanCard({
  job,
  company,
  plan,
}: {
  job: string;
  company: string;
  plan: ApplyPlan;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card opacity-90">
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{job}</span>
            <span className="text-sm text-muted-foreground">{company}</span>
            <Badge variant="muted" className="text-[10px]">
              offline preview
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <RouteBadge route={plan.route} />
            <StateBadge state={plan.nextState} />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {plan.knockouts.disqualified && (
        <div className="border-t border-border bg-[var(--danger)]/8 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--danger)]">
            <XCircle className="h-4 w-4 shrink-0" />
            Knocked out
          </div>
          <ul className="mt-1 space-y-0.5">
            {plan.knockouts.failures.map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                {f.requirement}: {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Routing reasons
            </p>
            <ul className="space-y-0.5">
              {plan.routeReasons.map((r, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {r}
                </li>
              ))}
            </ul>
          </div>
          {!plan.detection.clean && (
            <div className="mb-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Detection signals
              </p>
              <ul className="space-y-0.5">
                {plan.detection.signals.map((s, i) => (
                  <li key={i} className="text-xs text-[var(--warning)]">
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Prepared fields (preview)
          </p>
          <ReviewGate fields={plan.fields} readOnly />
        </div>
      )}
    </div>
  );
}

// --- Answers editor -----------------------------------------------------------

function AnswersEditor({
  initialAnswers,
}: {
  initialAnswers: ApplicationAnswersData;
}) {
  const [answers, setAnswers] = useState<ApplicationAnswersData>(initialAnswers);
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function patch(partial: Partial<ApplicationAnswersData>) {
    setAnswers((a) => ({ ...a, ...partial }));
    setSaved(false);
  }

  function save() {
    setError(null);
    startSave(async () => {
      try {
        await saveAnswersAction(answers);
        setSaved(true);
        router.refresh();
      } catch (e) {
        setError(msg(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-medium">Standard answers</h2>
        <Button onClick={save} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4 text-[var(--success)]" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving…" : saved ? "Saved" : "Save answers"}
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Confirm once - the engine reads these every time it fills a form. The
        AI never infers critical answers at submit time; it reads directly from
        here (plan §C).
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Work authorization */}
        <div>
          <Label>Work authorized in the US?</Label>
          <div className="mt-1 flex gap-3">
            {([true, false] as const).map((v) => (
              <label key={String(v)} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="workAuthorized"
                  checked={answers.workAuthorized === v}
                  onChange={() => patch({ workAuthorized: v })}
                  className="accent-accent"
                />
                {v ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </div>

        {/* Requires sponsorship */}
        <div>
          <Label>Requires visa sponsorship?</Label>
          <div className="mt-1 flex gap-3">
            {([true, false] as const).map((v) => (
              <label key={String(v)} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="requiresSponsorship"
                  checked={answers.requiresSponsorship === v}
                  onChange={() => patch({ requiresSponsorship: v })}
                  className="accent-accent"
                />
                {v ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </div>

        {/* Years of experience */}
        <div>
          <Label htmlFor="yearsExp">Years of experience</Label>
          <Input
            id="yearsExp"
            type="number"
            min={0}
            max={50}
            value={answers.yearsExperience ?? ""}
            onChange={(e) =>
              patch({
                yearsExperience: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder="e.g. 5"
            className="mt-1"
          />
        </div>

        {/* Salary expectation */}
        <div>
          <Label htmlFor="salary">Salary expectation (USD)</Label>
          <Input
            id="salary"
            type="number"
            min={0}
            value={answers.salaryExpectation ?? ""}
            onChange={(e) =>
              patch({
                salaryExpectation: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
            placeholder="e.g. 160000"
            className="mt-1"
          />
        </div>

        {/* Notice period */}
        <div>
          <Label htmlFor="notice">Notice period</Label>
          <Input
            id="notice"
            value={answers.noticePeriod ?? ""}
            onChange={(e) => patch({ noticePeriod: e.target.value || undefined })}
            placeholder="e.g. 2 weeks"
            className="mt-1"
          />
        </div>

        {/* Has clearance */}
        <div>
          <Label>Security clearance?</Label>
          <div className="mt-1 flex gap-3">
            {([true, false] as const).map((v) => (
              <label key={String(v)} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="hasClearance"
                  checked={answers.hasClearance === v}
                  onChange={() => patch({ hasClearance: v })}
                  className="accent-accent"
                />
                {v ? "Yes" : "No"}
              </label>
            ))}
          </div>
        </div>

        {/* LinkedIn */}
        <div>
          <Label htmlFor="li">LinkedIn URL</Label>
          <Input
            id="li"
            value={answers.linkedinUrl ?? ""}
            onChange={(e) =>
              patch({ linkedinUrl: e.target.value || undefined })
            }
            placeholder="https://linkedin.com/in/you"
            className="mt-1"
          />
        </div>

        {/* GitHub */}
        <div>
          <Label htmlFor="gh">GitHub URL</Label>
          <Input
            id="gh"
            value={answers.githubUrl ?? ""}
            onChange={(e) => patch({ githubUrl: e.target.value || undefined })}
            placeholder="https://github.com/you"
            className="mt-1"
          />
        </div>

        {/* Website */}
        <div>
          <Label htmlFor="web">Website / portfolio URL</Label>
          <Input
            id="web"
            value={answers.websiteUrl ?? ""}
            onChange={(e) =>
              patch({ websiteUrl: e.target.value || undefined })
            }
            placeholder="https://yoursite.dev"
            className="mt-1"
          />
        </div>

        {/* Locations */}
        <div>
          <Label htmlFor="locs">Preferred locations (comma-separated)</Label>
          <Input
            id="locs"
            value={answers.locations.join(", ")}
            onChange={(e) =>
              patch({
                locations: e.target.value
                  .split(",")
                  .map((l) => l.trim())
                  .filter(Boolean),
              })
            }
            placeholder="San Francisco, CA; Remote"
            className="mt-1"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}
    </div>
  );
}

// --- Queued jobs panel --------------------------------------------------------

function QueuedJobRow({
  job,
  resumeText,
  goalText,
  preparing,
  error,
  onPrepare,
}: {
  job: JobView;
  resumeText: string;
  goalText?: string;
  preparing: boolean;
  error?: string;
  onPrepare: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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
          <Button
            size="sm"
            variant="outline"
            onClick={onPrepare}
            disabled={preparing}
          >
            {preparing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Prepare application
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

function QueuedJobsPanel({
  queue,
  resumeText = "",
  goalText,
}: {
  queue: JobView[];
  resumeText?: string;
  goalText?: string;
}) {
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

  if (queue.length === 0) {
    return (
      <div className="surface-card p-5 text-center">
        <p className="font-medium">No jobs queued for apply</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover and score jobs in{" "}
          <Link href="/jobs" className="text-accent underline-offset-2 hover:underline">
            Searching
          </Link>
          , then return here to prepare applications.
        </p>
      </div>
    );
  }

  return (
    <div className="surface-card p-5">
      <h2 className="mb-1 font-medium">Jobs to apply to</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Click Prepare to have the AI plan every field - you review and approve
        before anything is submitted.
      </p>
      <div className="space-y-2">
        {queue.map((job) => (
          <QueuedJobRow
            key={job.id}
            job={job}
            resumeText={resumeText}
            goalText={goalText}
            preparing={preparing === job.id}
            error={errors[job.id]}
            onPrepare={() => prepare(job.id)}
          />
        ))}
      </div>
    </div>
  );
}

// --- Main workspace -----------------------------------------------------------

export function ApplyWorkspace({
  initialAnswers,
  applications,
  queue,
  preview,
  dbError,
  resumeText = "",
  goalText,
}: ApplyWorkspaceProps) {
  return (
    <div className="space-y-6">
      {/* Queue summary - Needs you / Running / Queued */}
      {!dbError && (
        <ApplyQueueHints applications={applications} queue={queue} />
      )}

      {/* Answers editor */}
      <AnswersEditor initialAnswers={initialAnswers} />

      {/* Live queue (DB-backed) */}
      {!dbError && (
        <QueuedJobsPanel
          queue={queue}
          resumeText={resumeText}
          goalText={goalText}
        />
      )}

      {/* Prepared / in-progress applications (DB-backed) */}
      {!dbError && applications.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium">Applications</h2>
          {applications.map((app) => (
            <ApplicationCard key={app.id} app={app} />
          ))}
        </div>
      )}

      {/* Offline preview (always shown - no DB required) */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 font-medium">Offline preview</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          These plans were built from fixture jobs with no database - they
          demonstrate the routing logic and review gate. Expand any card to see
          the itemized field table.
        </p>
        <div className="space-y-3">
          {preview.plans.map(({ job, company, plan }) => (
            <PreviewPlanCard
              key={`${company}-${job}`}
              job={job}
              company={company}
              plan={plan}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
