/**
 * Outcome learnings feed — surfaces rejection insights from the learning loop.
 */
"use client";

import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RejectionLearningView } from "@/lib/track/learnings-view";

const KIND_LABEL: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover letter",
  apply_answer: "Apply answers",
  targeting: "Targeting",
};

function LearningCard({ item }: { item: RejectionLearningView }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{item.company}</span>
        <span className="text-xs text-muted-foreground">{item.role}</span>
        <Badge
          variant={item.category === "SOFT_REJECTION" ? "muted" : "danger"}
          className="text-[10px]"
        >
          {item.category === "SOFT_REJECTION" ? "Soft rejection" : "Rejection"}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {item.primaryCategory}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>

      {item.suggestions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {item.suggestions.slice(0, 3).map((s) => (
            <li key={s.text} className="flex items-start gap-2 text-xs text-foreground/90">
              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
              <span>
                <span className="font-medium text-muted-foreground">
                  {KIND_LABEL[s.kind] ?? s.kind}:
                </span>{" "}
                {s.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[10px] text-muted-foreground">
        {new Date(item.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
        {item.signals.length > 0 && ` · signals: ${item.signals.slice(0, 2).join(", ")}`}
      </p>
    </div>
  );
}

export function LearningsFeed({
  items,
  preview = false,
}: {
  items: RejectionLearningView[];
  preview?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-accent" />
            Rejection learnings
          </CardTitle>
          {preview && (
            <Badge variant="muted" className="text-[10px]">
              sample preview
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Actionable fixes captured when you confirm rejections on the tracker.
          Advisory only — nothing auto-changes your profile.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No learnings yet. Confirm a rejection on{" "}
            <Link href="/track" className="text-accent hover:underline">
              Tracker
            </Link>{" "}
            to capture insights here.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <LearningCard key={item.id} item={item} />
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          <Link
            href="/training"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Training hub
            <ArrowRight className="h-3 w-3" />
          </Link>{" "}
          for gap analysis and resume standards.
        </p>
      </CardContent>
    </Card>
  );
}
