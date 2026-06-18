"use client";

import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { explainRejection } from "@/lib/track/rejection-learning";

interface RejectionExplanationPanelProps {
  emailText: string;
}

export function RejectionExplanationPanel({
  emailText,
}: RejectionExplanationPanelProps) {
  const explanation = explainRejection(emailText);

  return (
    <div className="mt-3 rounded-lg border border-[var(--danger)]/25 bg-[var(--danger)]/5 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Lightbulb className="h-3.5 w-3.5 text-[var(--danger)]" />
        <span className="text-xs font-medium text-foreground">
          Why this rejection likely happened
        </span>
        <Badge variant="muted" className="text-[10px]">
          {explanation.confidence} confidence
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{explanation.summary}</p>
      {explanation.categories.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {explanation.categories.map((cat) => (
            <Badge key={cat} variant="danger" className="text-[10px]">
              {cat}
            </Badge>
          ))}
        </div>
      )}
      {explanation.fixes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {explanation.fixes.slice(0, 4).map((fix) => (
            <li key={fix.text} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">
                {fix.module}:
              </span>{" "}
              {fix.text}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-muted-foreground">
        Shown before you confirm -{" "}
        <Link href="/training" className="text-accent hover:underline">
          Training hub →
        </Link>
      </p>
    </div>
  );
}
