"use client";

import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { computeAtsMatch } from "@/lib/scoring/ats-keywords";

interface AtsMatchPanelProps {
  jobDescription: string;
  resumeText: string;
  jobTitle?: string;
}

export function AtsMatchPanel({
  jobDescription,
  resumeText,
  jobTitle,
}: AtsMatchPanelProps) {
  if (!jobDescription.trim()) {
    return (
      <p className="text-xs text-muted-foreground">
        No job description stored - ATS match unavailable.
      </p>
    );
  }

  const result = computeAtsMatch(jobDescription, resumeText);

  if (result.totalKeywords === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Not enough JD text to compute keyword match.
      </p>
    );
  }

  const variant =
    result.matchPercent >= 70 ? "success" : result.matchPercent >= 45 ? "warning" : "danger";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">ATS keyword match</span>
        <Badge variant={variant} className="tabular-nums">
          {result.matchPercent}%
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          {result.matched.length}/{result.totalKeywords} terms in profile
        </span>
      </div>

      {result.gaps.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <AlertCircle className="h-3 w-3" />
            Gaps (consider for tailor{jobTitle ? ` - ${jobTitle}` : ""})
          </p>
          <div className="flex flex-wrap gap-1">
            {result.gaps.map((g) => (
              <span
                key={g}
                className="rounded-full bg-[var(--warning)]/10 px-2 py-0.5 text-[10px] text-[var(--warning)]"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {result.matched.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <CheckCircle2 className="h-3 w-3" />
            Matched
          </p>
          <div className="flex flex-wrap gap-1">
            {result.matched.slice(0, 12).map((m) => (
              <span
                key={m}
                className="rounded-full bg-[var(--success)]/10 px-2 py-0.5 text-[10px] text-[var(--success)]"
              >
                {m}
              </span>
            ))}
            {result.matched.length > 12 && (
              <span className="text-[10px] text-muted-foreground">
                +{result.matched.length - 12} more
              </span>
            )}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Lexical match from your master profile - not keyword stuffing.{" "}
        <Link href="/resume" className="text-accent hover:underline">
          Tailor resume →
        </Link>
      </p>
    </div>
  );
}
