/**
 * Kanban board (Phase 6, plan §8d). Renders the pipeline columns left → right
 * from the server-built BoardColumnView[] (already ordered by BOARD_COLUMNS).
 * Each card exposes a "Move" select; choosing a column calls
 * moveApplicationAction inside a transition and refreshes. In preview/readOnly
 * mode the select is disabled - the sample board is look-only.
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { moveApplicationAction } from "@/app/actions/track";
import {
  ActionFeedback,
  useActionFeedback,
} from "@/components/action-feedback";
import { BOARD_COLUMNS } from "@/lib/track/types";
import type { AppStatus, BoardAppView, BoardColumnView } from "@/lib/track/types";

type BadgeVariant = "muted" | "default" | "warning" | "success" | "danger" | "accent";

const STATUS_VARIANT: Record<AppStatus, BadgeVariant> = {
  WARM_PATH: "accent",
  TO_APPLY: "muted",
  APPLIED: "default",
  INTERVIEWING: "warning",
  OFFER: "success",
  REJECTED: "danger",
  SKIPPED: "muted",
};

const STATUS_LABEL: Record<AppStatus, string> = {
  WARM_PATH: "Warm path",
  TO_APPLY: "To apply",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  SKIPPED: "Skipped",
};

// Subtle distinct top accent per column.
const COLUMN_ACCENT: Record<AppStatus, string> = {
  WARM_PATH: "border-t-accent",
  TO_APPLY: "border-t-muted-foreground/40",
  APPLIED: "border-t-primary/50",
  INTERVIEWING: "border-t-[var(--warning)]",
  OFFER: "border-t-[var(--success)]",
  REJECTED: "border-t-[var(--danger)]",
  SKIPPED: "border-t-border",
};

// --- App card -----------------------------------------------------------------

function AppCard({
  app,
  readOnly,
  onMove,
}: {
  app: BoardAppView;
  readOnly: boolean;
  onMove: (appId: string, to: AppStatus) => void;
}) {
  const [pending, startTransition] = useTransition();

  const others = BOARD_COLUMNS.filter((s) => s !== app.status);

  function move(to: AppStatus) {
    if (readOnly || to === app.status) return;
    startTransition(() => onMove(app.id, to));
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-background p-3 transition-opacity",
        pending && "opacity-60",
      )}
    >
      <div className="truncate text-sm font-semibold text-foreground">
        {app.company}
      </div>
      {app.jobTitle && (
        <div className="truncate text-xs text-muted-foreground">
          {app.jobTitle}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant={STATUS_VARIANT[app.status]} className="text-[10px]">
          {STATUS_LABEL[app.status]}
        </Badge>
        {app.route && (
          <Badge variant="muted" className="text-[10px]">
            {app.route}
          </Badge>
        )}
      </div>

      <label className="mt-2 block">
        <span className="sr-only">Move {app.company}</span>
        <select
          value=""
          disabled={readOnly || pending}
          onChange={(e) => {
            if (e.target.value) move(e.target.value as AppStatus);
          }}
          className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Move…</option>
          {others.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

// --- Board --------------------------------------------------------------------

export function TrackBoard({
  board,
  readOnly,
}: {
  board: BoardColumnView[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { feedback, run, dismiss } = useActionFeedback();

  function handleMove(appId: string, to: AppStatus) {
    if (readOnly) return;
    void (async () => {
      const result = await run(() => moveApplicationAction(appId, to));
      if (result.ok) router.refresh();
    })();
  }

  return (
    <section className="mt-6">
      <ActionFeedback message={feedback} onDismiss={dismiss} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {board.map((col) => (
          <div
            key={col.status}
            className={cn(
              "rounded-xl border border-t-2 border-border bg-card",
              COLUMN_ACCENT[col.status],
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {col.title}
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                {col.apps.length}
              </span>
            </div>
            <div className="space-y-2 px-3 pb-3">
              {col.apps.length === 0 ? (
                <p className="py-2 text-center text-[11px] text-muted-foreground/50">
                  -
                </p>
              ) : (
                col.apps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    readOnly={readOnly}
                    onMove={handleMove}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
