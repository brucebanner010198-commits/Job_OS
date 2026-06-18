"use client";

/**
 * Automation & catch-up panel (Phase 9, plan §9 + "the hard reality" #3:
 * local-first can't mean 24/7). Presentational: it renders the OpsView the
 * scheduler already produced - the recurring jobs and their planner decisions,
 * the macOS launchd agent (copy-paste plist + install commands), and the
 * OPTIONAL Gmail push relay. The honest framing: a background runner catches up
 * on whatever is due whenever the machine is awake, idempotently - no always-on
 * server required.
 *
 * Safety role: this component never reads the system clock, never runs a job,
 * and never touches a DB/service/fixture/pipeline. Durations are formatted from
 * the injected `ops.plan.nowIso` via the pure humanizeDuration helper, and the
 * copy handlers are defensive (silent no-op when the clipboard is unavailable).
 */

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Clock, Copy, Mail, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { humanizeDuration } from "@/lib/scheduler/plan";
import type {
  OpsView,
  RunDecision,
  ScheduledJob,
} from "@/lib/scheduler/types";

type BadgeVariant =
  | "muted"
  | "default"
  | "outline"
  | "warning"
  | "success"
  | "danger"
  | "accent";

// --- Section heading ---------------------------------------------------------

function SectionHead({
  icon,
  title,
  badge,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {badge}
    </div>
  );
}

// --- One scheduled job -------------------------------------------------------

function JobRow({
  job,
  decision,
  nowIso,
}: {
  job: ScheduledJob;
  decision?: RunDecision;
  nowIso: string;
}) {
  const due = decision?.due ?? false;
  const statusVariant: BadgeVariant = due ? "warning" : "success";
  const statusLabel = due ? "Due now" : "Up to date";
  const failed = job.lastStatus === "failed";

  // Age since last run, derived from the INJECTED nowIso - never the clock.
  const ageSec = job.lastRunAt
    ? (Date.parse(nowIso) - Date.parse(job.lastRunAt)) / 1000
    : null;

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{job.label}</div>
          {decision?.reason && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {decision.reason}
            </p>
          )}
        </div>
        <Badge variant={statusVariant} className="shrink-0 text-[10px]">
          {statusLabel}
        </Badge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          every{" "}
          <span className="tabular-nums text-foreground">
            {humanizeDuration(job.intervalSec)}
          </span>
        </span>
        <span className="text-border">·</span>
        {ageSec !== null ? (
          <span>
            last run{" "}
            <span className="tabular-nums">{humanizeDuration(ageSec)}</span> ago
          </span>
        ) : (
          <span>no prior run</span>
        )}
        {job.lastStatus && (
          <span
            className={cn(
              "tabular-nums",
              failed ? "text-[var(--danger)]" : "text-muted-foreground",
            )}
          >
            {job.lastStatus}
            {job.lastDetail ? ` - ${job.lastDetail}` : ""}
          </span>
        )}
      </div>
    </div>
  );
}

// --- The panel ---------------------------------------------------------------

export function AutomationPanel({ ops }: { ops: OpsView }) {
  // One "which key did I copy?" state shared by both copy buttons.
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) - silently no-op.
    }
  }

  const dueCount = ops.plan.dueKinds.length;
  const decisionByKind = new Map(
    ops.plan.decisions.map((d) => [d.kind, d] as const),
  );
  const relay = ops.pushRelay;

  return (
    <section className="space-y-4">
      {/* -- 1) Scheduled jobs ------------------------------------------------ */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <SectionHead
            icon={<Clock className="h-4 w-4" />}
            title="Scheduled jobs"
            badge={
              <Badge
                variant={dueCount > 0 ? "accent" : "muted"}
                className="text-[10px]"
              >
                {dueCount} due
              </Badge>
            }
          />
          <div className="space-y-2">
            {ops.jobs.map((job) => (
              <JobRow
                key={job.kind}
                job={job}
                decision={decisionByKind.get(job.kind)}
                nowIso={ops.plan.nowIso}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* -- 2) Schedule it (launchd) ----------------------------------------- */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <SectionHead
            icon={<Terminal className="h-4 w-4" />}
            title="Schedule it (launchd)"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            The launchd agent runs scheduled jobs on interval and at wake
            (RunAtLoad), so work missed while away runs when the machine returns.
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {ops.launchd.label}
            </code>
            <span>
              runs every{" "}
              <span className="tabular-nums text-foreground">
                {humanizeDuration(ops.launchd.intervalSec)}
              </span>
            </span>
            {ops.launchd.installed ? (
              <Badge variant="success" className="text-[10px]">
                installed
              </Badge>
            ) : (
              <Badge variant="muted" className="text-[10px]">
                not installed
              </Badge>
            )}
          </div>

          {/* The plist - collapsible, with a copy button. */}
          <details className="group rounded-lg border border-border bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                Agent plist
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={(e) => {
                  e.preventDefault();
                  copy(ops.launchd.plist, "plist");
                }}
              >
                {copiedKey === "plist" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy plist
                  </>
                )}
              </Button>
            </summary>
            <div className="border-t border-border p-3">
              <p className="mb-2 text-[11px] text-muted-foreground">
                Save to{" "}
                <code className="font-mono text-foreground">
                  {ops.launchd.plistPath}
                </code>
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed text-foreground">
                <code>{ops.launchd.plist}</code>
              </pre>
            </div>
          </details>

          {/* Install commands - numbered, with a copy button. */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Install &amp; load
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => copy(ops.launchd.install.join("\n"), "commands")}
              >
                {copiedKey === "commands" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy commands
                  </>
                )}
              </Button>
            </div>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed text-foreground">
              <code>
                {ops.launchd.install.map((cmd, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="select-none tabular-nums text-muted-foreground">
                      {i + 1}.
                    </span>
                    <span className="whitespace-pre-wrap break-all">{cmd}</span>
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* -- 3) Gmail push relay (optional) ----------------------------------- */}
      <Card>
        <CardContent className="space-y-2 p-4">
          <SectionHead
            icon={<Mail className="h-4 w-4" />}
            title="Gmail push relay"
            badge={
              !relay.configured ? (
                <Badge variant="muted" className="text-[10px]">
                  Scheduled polling
                </Badge>
              ) : relay.enabled ? (
                <Badge variant="success" className="text-[10px]">
                  Push relay on
                </Badge>
              ) : (
                <Badge variant="muted" className="text-[10px]">
                  Push relay off
                </Badge>
              )
            }
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {relay.detail}
          </p>
          {relay.topic && (
            <div className="text-xs text-muted-foreground">
              topic{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
                {relay.topic}
              </code>
            </div>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            By default, polling on wake via launchd requires no always-on
            service. The push relay is an optional cloud subscriber for near-instant
            email sync. All features work without it.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
