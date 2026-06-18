"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
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

      {topGaps.length > 0 && (
        <ul className="space-y-1.5">
          {topGaps.map((gap) => (
            <li
              key={gap.id}
              className="rounded-md border border-border bg-card px-2.5 py-2 text-xs"
            >
              <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={PRIORITY_VARIANT[gap.priority]}
                  className="text-[10px]"
                >
                  {gap.priority}
                </Badge>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {gap.category}
                </span>
              </div>
              <p className="text-foreground">{gap.gap}</p>
              <p className="mt-0.5 flex items-start gap-1 text-muted-foreground">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                {gap.fix}
              </p>
            </li>
          ))}
        </ul>
      )}

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
