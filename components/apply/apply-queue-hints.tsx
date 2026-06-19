"use client";

import Link from "next/link";
import { HandMetal, Loader2, ListOrdered, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ApplicationRowView } from "@/lib/apply/service";
import type { JobView } from "@/lib/jobs/pipeline";
import type { ApplyState } from "@/lib/apply/types";
import {
  ApplicationCard,
  QueuedJobRow,
  usePrepareQueue,
} from "@/components/apply/apply-cards";

const NEEDS_YOU: ApplyState[] = ["REVIEW", "PAUSED", "HANDOFF"];
const RUNNING: ApplyState[] = ["PREPARING", "SUBMITTING"];

function bucketApplications(applications: ApplicationRowView[]) {
  const needsYou = applications.filter((a) =>
    NEEDS_YOU.includes(a.applyState as ApplyState),
  );
  const running = applications.filter((a) =>
    RUNNING.includes(a.applyState as ApplyState),
  );
  const queuedApps = applications.filter((a) => a.applyState === "QUEUED");
  return { needsYou, running, queuedApps };
}

function TaskColumn({
  title,
  icon: Icon,
  count,
  tone,
  highlight,
  children,
  emptyMessage,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  tone: "warning" | "accent" | "muted";
  highlight?: boolean;
  children: React.ReactNode;
  emptyMessage: string;
}) {
  const toneClasses = {
    warning: "border-[var(--warning)]/30 bg-[var(--warning)]/5",
    accent: "border-accent/30 bg-accent/5",
    muted: "border-border bg-muted/20",
  };
  const headerTone = {
    warning: "text-[var(--warning)]",
    accent: "text-accent",
    muted: "text-muted-foreground",
  };

  return (
    <div
      className={cn(
        "flex min-h-[12rem] flex-col rounded-xl border",
        toneClasses[tone],
        highlight && "ring-2 ring-[var(--warning)]/15",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", headerTone[tone])} aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {title}
          </span>
        </div>
        <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      <div className="flex-1 space-y-2 p-2">
        {count === 0 ? (
          <p className="py-6 text-center text-[11px] text-muted-foreground/70">
            {emptyMessage}
          </p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function ApplyQueueHints({
  applications,
  queue,
  resumeText = "",
  goalText,
  className,
}: {
  applications: ApplicationRowView[];
  queue: JobView[];
  resumeText?: string;
  goalText?: string;
  className?: string;
}) {
  const { needsYou, running, queuedApps } = bucketApplications(applications);
  const queuedCount = queue.length + queuedApps.length;
  const total = needsYou.length + running.length + queuedCount;
  const { preparing, errors, prepare } = usePrepareQueue();

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
          Discover jobs in{" "}
          <Link href="/jobs" className="text-accent underline-offset-2 hover:underline">
            Searching
          </Link>
          , then prepare applications here. Assisted routes land in &ldquo;Needs
          you&rdquo; for your approval.
        </p>
      </div>
    );
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-medium">Apply queue</h2>
          <p className="text-xs text-muted-foreground">
            Human-in-the-loop taskboard — expand a card for field review and approval.
          </p>
        </div>
        {needsYou.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--warning)]/12 px-2.5 py-1 text-xs font-medium text-[var(--warning)]">
            <Shield className="h-3.5 w-3.5" />
            {needsYou.length} checkpoint{needsYou.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <TaskColumn
          title="Needs you"
          icon={HandMetal}
          count={needsYou.length}
          tone="warning"
          highlight={needsYou.length > 0}
          emptyMessage="No approvals pending — assisted routes appear here."
        >
          {needsYou.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              compact
              defaultExpanded={needsYou.length === 1 && app.applyState === "REVIEW"}
            />
          ))}
        </TaskColumn>

        <TaskColumn
          title="Running"
          icon={Loader2}
          count={running.length}
          tone="accent"
          highlight={running.length > 0 && needsYou.length === 0}
          emptyMessage="Nothing preparing or submitting right now."
        >
          {running.map((app) => (
            <ApplicationCard key={app.id} app={app} compact />
          ))}
        </TaskColumn>

        <TaskColumn
          title="Queued"
          icon={ListOrdered}
          count={queuedCount}
          tone="muted"
          emptyMessage="Queue jobs from Searching, then Prepare here."
        >
          {queue.map((job) => (
            <QueuedJobRow
              key={job.id}
              job={job}
              resumeText={resumeText}
              goalText={goalText}
              preparing={preparing === job.id}
              error={errors[job.id]}
              onPrepare={() => prepare(job.id)}
              compact
            />
          ))}
          {queuedApps.map((app) => (
            <ApplicationCard key={app.id} app={app} compact />
          ))}
        </TaskColumn>
      </div>
    </section>
  );
}
