"use client";

import { ExternalLink, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { suggestHrContacts } from "@/lib/brief/hr-contacts";
import type { SerializedBriefData } from "@/app/actions/brief";

const CONFIDENCE_VARIANT = {
  high: "success",
  medium: "warning",
  low: "muted",
} as const;

interface HrContactsPanelProps {
  company: string;
  brief: SerializedBriefData;
  careersPageUrl?: string;
}

export function HrContactsPanel({
  company,
  brief,
  careersPageUrl,
}: HrContactsPanelProps) {
  const hints = suggestHrContacts({
    company,
    brief,
    careersPageUrl,
  });

  if (hints.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start gap-2">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">HR outreach hints</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Suggested roles from brief leadership claims and careers context -
            draft guidance only, no auto-send.
          </p>
        </div>
      </div>
      <ul className="space-y-3">
        {hints.map((hint) => (
          <li
            key={hint.role}
            className="rounded-lg border border-border bg-background p-3 text-xs"
          >
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{hint.label}</span>
              <Badge
                variant={CONFIDENCE_VARIANT[hint.confidence]}
                className="text-[10px]"
              >
                {hint.confidence}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/80">Where: </span>
              {hint.whereToFind}
            </p>
            <p className="mt-1 text-muted-foreground">
              <span className="font-medium text-foreground/80">Tip: </span>
              {hint.outreachTip}
            </p>
            {hint.sourceUrl && (
              <a
                href={hint.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-accent hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Source
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
