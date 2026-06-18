"use client";

/**
 * Backups panel (Phase 11). Presentational + the small set of actions that drive
 * the backup API routes. It renders the BackupView the service produced - the
 * schedule health, the snapshot list, restore/export actions, and a copy-paste
 * launchd agent that runs `npm run backup` daily and on wake.
 *
 * Safety UX: a restore REPLACES the live profile, so it's a two-click confirm and
 * the copy says a safety snapshot is taken first. All durations come from the
 * injected view (no clock read here); the copy handler is a defensive no-op when
 * the clipboard is unavailable.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  ChevronDown,
  Clock,
  Copy,
  Download,
  HardDriveDownload,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { humanizeDuration } from "@/lib/scheduler/plan";
import type { BackupRecord, BackupView } from "@/lib/backup/types";

export interface LaunchdInfo {
  label: string;
  intervalSec: number;
  plistPath: string;
  plist: string;
  install: string[];
}

type BadgeVariant =
  | "muted"
  | "default"
  | "outline"
  | "warning"
  | "success"
  | "danger"
  | "accent";

const TRIGGER_VARIANT: Record<string, BadgeVariant> = {
  manual: "default",
  scheduled: "accent",
  "pre-restore": "warning",
};

/** Stable, hydration-safe timestamp (UTC), e.g. "2026-06-17 06:00". */
function fmt(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// --- section heading ---------------------------------------------------------

function SectionHead({
  icon,
  title,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  badge?: React.ReactNode;
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

// --- one snapshot row --------------------------------------------------------

function BackupRow({
  rec,
  disabled,
  pendingRestore,
  busy,
  onRestore,
}: {
  rec: BackupRecord;
  disabled: boolean;
  pendingRestore: boolean;
  busy: boolean;
  onRestore: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium tabular-nums text-foreground">
              {fmt(rec.createdAt)}
            </span>
            <Badge
              variant={TRIGGER_VARIANT[rec.trigger] ?? "muted"}
              className="text-[10px]"
            >
              {rec.trigger}
            </Badge>
            {rec.label && (
              <span className="text-xs text-muted-foreground">{rec.label}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{rec.entryCount} entries</span>
            <span className="text-border">·</span>
            <span className="tabular-nums">{rec.noteCount} notes</span>
            {rec.sensitiveCount > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="tabular-nums">
                  {rec.sensitiveCount} sensitive
                </span>
              </>
            )}
            <span className="text-border">·</span>
            <span className="tabular-nums">{fmtBytes(rec.byteSize)}</span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "h-7 shrink-0 px-2 text-xs",
            pendingRestore &&
              "border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)]/10",
          )}
          disabled={disabled || busy}
          onClick={() => onRestore(rec.id)}
        >
          {busy && pendingRestore ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {pendingRestore ? "Confirm restore?" : "Restore"}
        </Button>
      </div>
    </div>
  );
}

// --- the panel ---------------------------------------------------------------

export function BackupPanel({
  view,
  launchd,
  preview,
}: {
  view: BackupView;
  launchd: LaunchdInfo;
  preview: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "create" | "restore">(null);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* clipboard unavailable - no-op */
    }
  }

  async function backupNow() {
    setBusy("create");
    setMsg(null);
    try {
      const r = await fetch("/api/backup/create", { method: "POST" });
      const data = await r.json();
      if (data.ok) {
        setMsg({
          kind: "ok",
          text: data.deduped
            ? "Profile unchanged - no new snapshot needed."
            : `Snapshot saved (${data.record.entryCount} entries, ${data.record.noteCount} notes).`,
        });
        router.refresh();
      } else {
        setMsg({ kind: "err", text: data.error ?? "Backup failed." });
      }
    } catch {
      setMsg({ kind: "err", text: "Backup request failed." });
    } finally {
      setBusy(null);
    }
  }

  async function onRestore(id: string) {
    // Two-click confirm: first click arms, second click (same row) executes.
    if (pendingRestore !== id) {
      setPendingRestore(id);
      setMsg(null);
      return;
    }
    setBusy("restore");
    try {
      const r = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backupId: id }),
      });
      const data = await r.json();
      if (data.ok) {
        setMsg({
          kind: "ok",
          text: `Restored ${data.result.restoredEntries} entries, ${data.result.restoredNotes} notes (safety snapshot taken first).`,
        });
        router.refresh();
      } else {
        setMsg({
          kind: "err",
          text: data.result?.reason ?? data.error ?? "Restore failed.",
        });
      }
    } catch {
      setMsg({ kind: "err", text: "Restore request failed." });
    } finally {
      setBusy(null);
      setPendingRestore(null);
    }
  }

  const due = view.schedule.due;
  const keyLabel =
    view.keySource === "env"
      ? "configured key"
      : view.keySource === "app-key"
        ? "local app key"
        : "no key yet";

  return (
    <div className="space-y-4">
      {/* -- 1) Schedule + actions -------------------------------------------- */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <SectionHead
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Profile backup"
            badge={
              <Badge
                variant={due ? "warning" : "success"}
                className="text-[10px]"
              >
                {due ? "Backup due" : "Up to date"}
              </Badge>
            }
          />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{view.schedule.reason}</span>
            <span className="text-border">·</span>
            <span>
              every{" "}
              <span className="tabular-nums text-foreground">
                {humanizeDuration(view.schedule.intervalSec)}
              </span>
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> {keyLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={backupNow}
              disabled={preview || busy !== null}
            >
              {busy === "create" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HardDriveDownload className="h-4 w-4" />
              )}
              Back up now
            </Button>
            {preview ? (
              <span
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "pointer-events-none opacity-50",
                )}
              >
                <Download className="h-4 w-4" /> Export JSON
              </span>
            ) : (
              <a
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                href="/api/backup/export"
              >
                <Download className="h-4 w-4" /> Export JSON
              </a>
            )}
          </div>

          {preview && (
            <p className="text-xs text-muted-foreground">
              This is sample data. Start Postgres (<code>npm run db:up</code>) to
              enable live backups, restore, and export.
            </p>
          )}
          {msg && (
            <p
              className={cn(
                "text-xs",
                msg.kind === "ok"
                  ? "text-[var(--success)]"
                  : "text-[var(--danger)]",
              )}
            >
              {msg.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* -- 2) Snapshot history ---------------------------------------------- */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <SectionHead
            icon={<Archive className="h-4 w-4" />}
            title="Snapshots"
            badge={
              <Badge variant="muted" className="text-[10px]">
                {view.backups.length} saved
              </Badge>
            }
          />
          {view.backups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
              No snapshots yet. Click <strong>Back up now</strong> to take your
              first encrypted snapshot.
            </div>
          ) : (
            <div className="space-y-2">
              {view.backups.map((rec) => (
                <BackupRow
                  key={rec.id}
                  rec={rec}
                  disabled={preview}
                  pendingRestore={pendingRestore === rec.id}
                  busy={busy === "restore"}
                  onRestore={onRestore}
                />
              ))}
            </div>
          )}
          {pendingRestore && (
            <p className="text-xs text-[var(--danger)]">
              Restoring replaces your current profile with that snapshot. A safety
              snapshot of the current state is taken first. Click{" "}
              <strong>Confirm restore?</strong> again to proceed.
            </p>
          )}
        </CardContent>
      </Card>

      {/* -- 3) Automate it (launchd) ----------------------------------------- */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <SectionHead
            icon={<Clock className="h-4 w-4" />}
            title="Automate it (launchd)"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Run the backup daily and on wake with a launchd agent pointed at{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground">
              npm run backup
            </code>{" "}
            - it only writes when the profile changed, so it&apos;s safe to run
            often.
          </p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {launchd.label}
            </code>
            <span>
              runs every{" "}
              <span className="tabular-nums text-foreground">
                {humanizeDuration(launchd.intervalSec)}
              </span>
            </span>
          </div>

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
                  copy(launchd.plist, "plist");
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
                  {launchd.plistPath}
                </code>
              </p>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-[11px] leading-relaxed text-foreground">
                <code>{launchd.plist}</code>
              </pre>
            </div>
          </details>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" /> Install &amp; load
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => copy(launchd.install.join("\n"), "commands")}
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
                {launchd.install.map((cmd, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {cmd}
                  </div>
                ))}
              </code>
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
