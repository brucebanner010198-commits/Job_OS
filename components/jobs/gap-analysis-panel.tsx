"use client";

import Link from "next/link";
import { AlertCircle, ExternalLink, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { analyzeGaps } from "@/lib/candidate/gap-analysis";
import type { GapPriority } from "@/lib/candidate/gap-analysis";

const PRIORITY_VARIANT: Record<
  GapPriority,
  "danger" | "warning" | "muted" | "default"
> = {
  critical: "danger",
  high: "warning",
  medium: "default",
  low: "muted",
};

interface GapAnalysisPanelProps {
  profileText: string;
  jobDescription: string;
  company?: string;
  roleTitle?: string;
  goalText?: string;
}

export function GapAnalysisPanel({
  profileText,
  jobDescription,
  company,
  roleTitle,
  goalText,
}: GapAnalysisPanelProps) {
  if (!jobDescription.trim() || !profileText.trim()) {
    return (
      <p className="text-xs text-muted-foreground">
        Add a master profile and job description to run gap analysis.
      </p>
    );
  }

  const result = analyzeGaps({
    profileText,
    jobDescription,
    goalText,
    company,
    roleTitle,
  });

  const topGaps = result.gaps.slice(0, 5);
  const variant =
    result.matchPercent >= 70
      ? "success"
      : result.matchPercent >= 45
        ? "warning"
        : "danger";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Gap analysis
        </span>
        <Badge variant={variant} className="tabular-nums">
          {result.matchPercent}% match
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{result.summary}</p>

        <ul className="space-y-2">
          {topGaps.map((gap) => (
            <li
              key={gap.id}
              className="rounded-md border border-border bg-card p-3 text-xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={PRIORITY_VARIANT[gap.priority]}
                    className="text-[10px]"
                  >
                    {gap.priority}
                  </Badge>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    {gap.category}
                  </span>
                </div>
                {gap.skillName && (
                  <Link
                    href={`/journal`}
                    className="text-[11px] text-accent hover:underline flex items-center gap-1 font-medium"
                  >
                    <BookOpen className="h-3 w-3" />
                    Practice & log in journal
                  </Link>
                )}
              </div>
              <p className="text-foreground font-medium">{gap.gap}</p>
              <p className="text-muted-foreground flex items-start gap-1">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {gap.fix}
              </p>

              {gap.resources && gap.resources.length > 0 && (
                <div className="pt-1.5 border-t border-border/50 mt-1 space-y-1">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Recommended learning resources:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {gap.resources.map((res, rIdx) => (
                      <a
                        key={rIdx}
                        href={res.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-muted/60 hover:bg-muted text-[11px] text-foreground transition-colors border border-border/40"
                      >
                        <ExternalLink className="h-3 w-3 text-accent" />
                        <span>{res.title}</span>
                        <span className="text-[9px] text-muted-foreground uppercase">({res.type})</span>
                      </a>
                    ))}
                  </div>
                  {gap.resources[0]?.practiceProject && (
                    <p className="text-[10px] text-muted-foreground italic mt-0.5">
                      💡 Project prompt: {gap.resources[0].practiceProject}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

      {result.gaps.length > topGaps.length && (
        <p className="text-[10px] text-muted-foreground">
          +{result.gaps.length - topGaps.length} more gap(s) -{" "}
          <Link href="/training" className="text-accent hover:underline">
            Training hub →
          </Link>
        </p>
      )}
    </div>
  );
}
