"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScreeningScore } from "@/lib/resume/screening-score";
import type { RecruiterSummary } from "@/lib/resume/recruiter-summary";

export interface RecruiterSkimViewProps {
  skimHtml: string;
  screening: ScreeningScore;
  summary: RecruiterSummary;
  className?: string;
}

const LIKELIHOOD_LABEL = {
  strong: { text: "Strong fit signal", variant: "success" as const },
  moderate: { text: "Moderate fit", variant: "warning" as const },
  weak: { text: "Weak skim signal", variant: "danger" as const },
};

/**
 * HR packet view - what a recruiter sees in ~6 seconds:
 * fit summary (3 lines) + top-third highlighted resume preview.
 */
export function RecruiterSkimView({
  skimHtml,
  screening,
  summary,
  className,
}: RecruiterSkimViewProps) {
  const likelihood = LIKELIHOOD_LABEL[summary.interviewLikelihood];

  return (
    <div className={cn("space-y-4", className)}>
      <section
        aria-label="Recruiter fit summary"
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">6-second fit packet</h3>
          <Badge variant={likelihood.variant}>{likelihood.text}</Badge>
          <Badge variant="muted" className="tabular-nums">
            Overall {screening.overall}/100
          </Badge>
        </div>
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Fit
            </dt>
            <dd className="mt-0.5 font-medium leading-snug">{summary.fitLine}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Proof
            </dt>
            <dd className="mt-0.5 text-muted-foreground leading-snug">
              {summary.proofLine}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Signal
            </dt>
            <dd className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {summary.signalLine}
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant={screening.passesAts ? "success" : "warning"}>
            ATS {screening.keywordMatchPercent}%
          </Badge>
          <Badge variant={screening.passesSkim ? "success" : "warning"}>
            Skim {screening.skim.score}/100
          </Badge>
          <Badge variant="outline">
            Metrics {screening.skim.metricsInTopFold}/
            {screening.skim.metricsInTopFoldRequired}
          </Badge>
        </div>
      </section>

      <section aria-label="Top-third resume highlight">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">~6 second first pass</Badge>
          {screening.skim.headlineAligned ? (
            <Badge variant="success">Headline aligned</Badge>
          ) : (
            <Badge variant="warning">Headline mismatch</Badge>
          )}
        </div>
        <iframe
          title="Recruiter skim preview"
          srcDoc={skimHtml}
          className="h-[720px] w-full rounded-lg border border-[var(--success)]/30 bg-card"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Green highlight ≈ top third recruiters scan first - name, headline,
          summary, strongest bullets, and key skills.
        </p>
      </section>

      {screening.redFlags.length > 0 && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {screening.redFlags.map((f, i) => (
            <li key={i}>
              <Badge
                variant={f.severity === "block" ? "warning" : "muted"}
                className="mr-1.5"
              >
                {f.severity}
              </Badge>
              {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
