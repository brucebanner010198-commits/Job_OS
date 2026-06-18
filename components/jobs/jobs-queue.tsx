"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { discoverJobsAction } from "@/app/actions/jobs";
import { RouteBadge } from "@/components/pipeline/route-badge";
import { recruiterSkimHref } from "@/lib/pipeline/recruiter-skim";
import { ApplyReadinessBadge } from "@/components/jobs/apply-readiness-badge";
import { AtsMatchPanel } from "@/components/jobs/ats-match-panel";
import { GapAnalysisPanel } from "@/components/jobs/gap-analysis-panel";
import { PipelineStageBadge } from "@/components/jobs/pipeline-stage-badge";
import type { JobView, FilteredView } from "@/lib/jobs/pipeline";
import type { ScreenResult } from "@/lib/jobs/types";

// --- Helpers -----------------------------------------------------------------

function fmtSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `up to ${fmt(max)}`;
  return null;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

const DRIVER_LABEL: Record<string, string> = {
  resume: "via your history",
  goals: "via your goals",
  both: "via both",
};

// --- Score bar ----------------------------------------------------------------

function ScoreBar({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "accent" | "success";
}) {
  const barColor =
    accent === "accent" ? "bg-accent" : "bg-[var(--success)]";
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="w-20 shrink-0">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="w-7 text-right tabular-nums">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

// --- Job row ------------------------------------------------------------------

function JobRow({
  job,
  resumeText,
  goalText,
}: {
  job: JobView;
  resumeText: string;
  goalText?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const salary = fmtSalary(job.salaryMin, job.salaryMax);

  return (
    <li className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
      {/* Main row */}
      <div className="flex items-start gap-4 p-4">
        {/* Score badge */}
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg text-xs font-bold",
            job.hardGatePass
              ? "bg-accent/10 text-accent"
              : "bg-[var(--warning)]/10 text-[var(--warning)]",
          )}
        >
          <span className="text-base leading-none">
            {Math.round(job.score * 100)}
          </span>
          <span className="mt-0.5 text-[10px] font-normal opacity-60">
            score
          </span>
        </div>

        {/* Job info */}
        <div className="min-w-0 flex-1">
          {/* Title + badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{job.title}</span>
            <RouteBadge route={job.routePreview} size="sm" />
            {job.fresh && (
              <Badge variant="success" className="text-[10px]">
                fresh &lt;24h
              </Badge>
            )}
            {!job.hardGatePass && (
              <Badge variant="warning" className="text-[10px]">
                hard gate
              </Badge>
            )}
          </div>

          <PipelineStageBadge className="mt-1.5" />

          {/* Company, location, salary */}
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            <span>{job.company}</span>
            {job.location && (
              <>
                <span>·</span>
                <span>{job.location}</span>
              </>
            )}
            {job.remote && (
              <Badge variant="muted" className="text-[10px]">
                remote
              </Badge>
            )}
            {salary && (
              <>
                <span>·</span>
                <span className="tabular-nums">{salary}</span>
              </>
            )}
          </div>

          {/* Apply readiness */}
          <div className="mt-2">
            <ApplyReadinessBadge
              jobScore={job.score}
              route={job.routePreview}
              hardGatePass={job.hardGatePass}
              jobDescription={job.description}
              resumeText={resumeText}
            />
          </div>

          {/* Score bars */}
          <div className="mt-2 space-y-1">
            <ScoreBar
              label="Relevance"
              value={job.relevance}
              accent="accent"
            />
            <ScoreBar
              label="Reachability"
              value={job.reachability}
              accent="success"
            />
          </div>

          {/* Tags: driver + source + hard-gate caps */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge
              variant={
                job.relevanceDriver === "goals"
                  ? "success"
                  : job.relevanceDriver === "both"
                    ? "accent"
                    : "muted"
              }
              className="text-[10px]"
            >
              {DRIVER_LABEL[job.relevanceDriver]}
            </Badge>
            <span className="text-xs text-muted-foreground">
              via {job.source}
            </span>
            {job.caps.map((cap, i) => (
              <span
                key={i}
                title={cap.reason}
                className="cursor-help rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] text-[var(--warning)]"
              >
                {cap.requirement}
              </span>
            ))}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded((s) => !s)}
          aria-expanded={expanded}
          aria-label="Why this score"
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expandable "Why this score" panel */}
      {expanded && (
        <div className="border-t border-border bg-background px-4 py-3 text-xs">
          <p className="mb-2 font-medium text-muted-foreground">
            Why this score
          </p>
          <div className="space-y-1.5">
            <div className="flex gap-3 text-muted-foreground">
              <span className="w-24 shrink-0">Relevance</span>
              <span className="tabular-nums">
                {Math.round(job.relevance * 100)}%
              </span>
              <span className="text-muted-foreground/50">
                ({job.relevanceDriver})
              </span>
            </div>
            <div className="flex gap-3 text-muted-foreground">
              <span className="w-24 shrink-0">Reachability</span>
              <span className="tabular-nums">
                {Math.round(job.reachability * 100)}%
              </span>
            </div>
            <div className="flex gap-3 text-muted-foreground">
              <span className="w-24 shrink-0">Recency bonus</span>
              <span className="tabular-nums">
                +{(job.recencyBonus * 100).toFixed(1)}pts
              </span>
            </div>

            {job.caps.length > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="font-medium text-[var(--warning)]">
                  Hard-gate caps:
                </p>
                {job.caps.map((cap, i) => (
                  <p key={i} className="text-[var(--warning)]/80">
                    {cap.reason}
                  </p>
                ))}
              </div>
            )}

            {job.notes.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {job.notes.map((note, i) => (
                  <li key={i} className="flex gap-1.5 text-muted-foreground">
                    <span className="text-accent">•</span>
                    {note}
                  </li>
                ))}
              </ul>
            )}

            {job.description && resumeText && (
              <div className="mt-3 space-y-3 border-t border-border pt-3">
                <AtsMatchPanel
                  jobDescription={job.description}
                  resumeText={resumeText}
                  jobTitle={job.title}
                />
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

          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-accent underline-offset-2 hover:underline"
            >
              View posting →
            </a>
          )}

          <Link
            href={recruiterSkimHref(job.company, job.title)}
            className="ml-4 mt-3 inline-block text-sm text-muted-foreground underline-offset-2 hover:text-accent hover:underline"
          >
            Recruiter skim →
          </Link>
        </div>
      )}
    </li>
  );
}

// --- Filtered section ---------------------------------------------------------

const REASON_LABEL: Record<string, string> = {
  duplicate: "Duplicates",
  ghost: "Ghost postings",
  scam: "Scam postings",
};

function FilteredSection({ filtered }: { filtered: FilteredView[] }) {
  const [open, setOpen] = useState(false);

  // Group by reason in display order
  const groups: Record<string, FilteredView[]> = {};
  for (const j of filtered) {
    (groups[j.reason] ??= []).push(j);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          Filtered out
          <span className="text-muted-foreground">({filtered.length})</span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
          <p className="text-xs text-muted-foreground">
            These postings were removed before scoring - visible proof the
            dedupe, ghost, and scam filters are working.
          </p>
          {(["duplicate", "ghost", "scam"] as const).map((reason) => {
            const group = groups[reason];
            if (!group?.length) return null;
            return (
              <div key={reason}>
                <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {REASON_LABEL[reason]} ({group.length})
                </h3>
                <ul className="space-y-1.5">
                  {group.map((j, i) => (
                    <li
                      key={i}
                      className="rounded-lg border border-border bg-background px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{j.title}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {j.company}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {j.source}
                        </span>
                      </div>
                      {j.reasons.length > 0 && (
                        <ul className="mt-1 flex flex-wrap gap-1">
                          {j.reasons.map((r, ri) => (
                            <li
                              key={ri}
                              className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                            >
                              {r}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- Main component -----------------------------------------------------------

export function JobsQueue({
  queue,
  filtered,
  isPreview,
  stats,
  resumeText = "",
  goalText = "",
}: {
  queue: JobView[];
  filtered: FilteredView[];
  isPreview: boolean;
  stats: ScreenResult["stats"] | null;
  resumeText?: string;
  goalText?: string;
}) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{
    ingested: number;
    kept: number;
    filtered: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runDiscover() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const counts = await discoverJobsAction(query);
        setResult(counts);
      } catch (e) {
        setError(errMsg(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Discover panel */}
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <h2 className="font-medium">Discover jobs</h2>
        <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
          Enter a role or leave blank for the default query. Postings are
          deduplicated, ghost- and scam-screened, then scored against your
          profile and goals before entering the queue.
        </p>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !pending) runDiscover();
            }}
            placeholder="e.g. software engineer, product manager…"
            className="flex-1"
            disabled={pending}
          />
          <Button onClick={runDiscover} disabled={pending} variant="accent">
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Discovering…
              </>
            ) : (
              <>
                <Search className="h-4 w-4" /> Discover jobs
              </>
            )}
          </Button>
        </div>
        {result && (
          <p className="mt-2 text-sm text-muted-foreground">
            Found <strong className="text-foreground">{result.ingested}</strong>{" "}
            postings → <strong className="text-foreground">{result.kept}</strong>{" "}
            kept,{" "}
            <strong className="text-foreground">{result.filtered}</strong>{" "}
            filtered out.
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
        )}
      </div>

      {/* Preview notice */}
      {isPreview && (
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3.5 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-muted-foreground">
            Preview from sample postings - connect Postgres and click Discover
            to ingest and score live jobs.
          </p>
        </div>
      )}

      {/* Pipeline stats */}
      {stats && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>
            <strong className="text-foreground">{stats.total}</strong> ingested
          </span>
          <span>
            <strong className="text-foreground">{stats.kept}</strong> in queue
          </span>
          <span>
            <strong className="text-foreground">{stats.duplicates}</strong>{" "}
            dupes
          </span>
          <span>
            <strong className="text-foreground">{stats.ghosts}</strong> ghosts
          </span>
          <span>
            <strong className="text-foreground">{stats.scams}</strong> scams
          </span>
        </div>
      )}

      {/* Ranked queue */}
      {queue.length > 0 ? (
        <div>
          <h2 className="mb-3 font-medium">
            Ranked queue{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({queue.length})
            </span>
          </h2>
          <ol className="space-y-3">
            {queue.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                resumeText={resumeText}
                goalText={goalText}
              />
            ))}
          </ol>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-10 text-center shadow-sm">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
          <p className="font-medium">No jobs in queue yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Click &ldquo;Discover jobs&rdquo; above to find and score postings
            matched to your profile and goals.
          </p>
        </div>
      )}

      {/* Filtered audit trail */}
      {filtered.length > 0 && <FilteredSection filtered={filtered} />}
    </div>
  );
}
