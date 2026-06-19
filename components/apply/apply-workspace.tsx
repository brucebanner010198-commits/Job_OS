"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Save,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ApplyQueueHints } from "@/components/apply/apply-queue-hints";
import { ReviewGate, StateBadge } from "@/components/apply/apply-cards";
import { RouteBadge } from "@/components/pipeline/route-badge";
import type {
  ApplicationAnswersData,
  ApplyPlan,
} from "@/lib/apply/types";
import type { ApplicationRowView } from "@/lib/apply/service";
import type { JobView } from "@/lib/jobs/pipeline";
import { saveAnswersAction } from "@/app/actions/apply";

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
            <p className="mb-1 text-xs font-medium text-muted-foreground">Routing reasons</p>
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
              <p className="mb-1 text-xs font-medium text-muted-foreground">Detection signals</p>
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
        Confirm once - the engine reads these every time it fills a form. The AI
        never infers critical answers at submit time; it reads directly from here.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                yearsExperience: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="e.g. 5"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="salary">Salary expectation (USD)</Label>
          <Input
            id="salary"
            type="number"
            min={0}
            value={answers.salaryExpectation ?? ""}
            onChange={(e) =>
              patch({
                salaryExpectation: e.target.value ? Number(e.target.value) : undefined,
              })
            }
            placeholder="e.g. 160000"
            className="mt-1"
          />
        </div>

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

        <div>
          <Label htmlFor="li">LinkedIn URL</Label>
          <Input
            id="li"
            value={answers.linkedinUrl ?? ""}
            onChange={(e) => patch({ linkedinUrl: e.target.value || undefined })}
            placeholder="https://linkedin.com/in/you"
            className="mt-1"
          />
        </div>

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

        <div>
          <Label htmlFor="web">Website / portfolio URL</Label>
          <Input
            id="web"
            value={answers.websiteUrl ?? ""}
            onChange={(e) => patch({ websiteUrl: e.target.value || undefined })}
            placeholder="https://yoursite.dev"
            className="mt-1"
          />
        </div>

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
      {!dbError && (
        <ApplyQueueHints
          applications={applications}
          queue={queue}
          resumeText={resumeText}
          goalText={goalText}
        />
      )}

      <AnswersEditor initialAnswers={initialAnswers} />

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 font-medium">Offline preview</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Plans built from fixture jobs with no database — expand any card to see
          routing logic and the review gate.
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
