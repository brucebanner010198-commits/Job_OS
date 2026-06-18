"use client";

import { HandMetal, Loader2, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApplicationRowView } from "@/lib/apply/service";
import type { JobView } from "@/lib/jobs/pipeline";
import type { ApplyState } from "@/lib/apply/types";

const NEEDS_YOU: ApplyState[] = ["REVIEW", "PAUSED", "HANDOFF"];
const RUNNING: ApplyState[] = ["PREPARING", "SUBMITTING"];

function countBuckets(applications: ApplicationRowView[], queue: JobView[]) {
  const needsYou = applications.filter((a) =>
    NEEDS_YOU.includes(a.applyState as ApplyState),
  ).length;
  const running = applications.filter((a) =>
    RUNNING.includes(a.applyState as ApplyState),
  ).length;
  const queued =
    queue.length +
    applications.filter((a) => a.applyState === "QUEUED").length;

  return { needsYou, running, queued };
}

function HintPill({
  icon: Icon,
  label,
  count,
  tone,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  count: number;
  tone: "warning" | "accent" | "muted";
  highlight?: boolean;
}) {
  const toneClasses = {
    warning: "border-[var(--warning)]/30 bg-[var(--warning)]/8 text-[var(--warning)]",
    accent: "border-accent/30 bg-accent/10 text-accent",
    muted: "border-border bg-muted/40 text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "flex min-h-11 flex-1 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all duration-200",
        toneClasses[tone],
        highlight && "ring-2 ring-[var(--warning)]/20 shadow-sm",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs font-medium leading-none">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums leading-none">
          {count}
        </p>
      </div>
    </div>
  );
}

export function ApplyQueueHints({
  applications,
  queue,
  className,
}: {
  applications: ApplicationRowView[];
  queue: JobView[];
  className?: string;
}) {
  const { needsYou, running, queued } = countBuckets(applications, queue);
  const total = needsYou + running + queued;

  if (total === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-border/60 bg-card p-5 text-center shadow-sm",
          className,
        )}
      >
        <ListOrdered className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
        <p className="font-medium">Nothing in the apply queue yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover jobs in Searching, then prepare applications here. Assisted
          routes will land in &ldquo;Needs you&rdquo; for your approval.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Apply queue
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <HintPill
          icon={HandMetal}
          label="Needs you"
          count={needsYou}
          tone="warning"
          highlight={needsYou > 0}
        />
        <HintPill
          icon={Loader2}
          label="Running"
          count={running}
          tone="accent"
          highlight={running > 0 && needsYou === 0}
        />
        <HintPill
          icon={ListOrdered}
          label="Queued"
          count={queued}
          tone="muted"
        />
      </div>
      {needsYou > 0 && (
        <p className="text-xs text-muted-foreground">
          {needsYou} application{needsYou === 1 ? "" : "s"} waiting for your
          review - expand the card below to approve fields.
        </p>
      )}
    </div>
  );
}
