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

const COLUMN_ACCENT: Record<AppStatus, string> = {
  WARM_PATH: "border-t-accent",
  TO_APPLY: "border-t-muted-foreground/40",
  APPLIED: "border-t-primary/50",
  INTERVIEWING: "border-t-[var(--warning)]",
  OFFER: "border-t-[var(--success)]",
  REJECTED: "border-t-[var(--danger)]",
  SKIPPED: "border-t-border",
};

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
      <div className="truncate text-sm font-semibold text-foreground">{app.company}</div>
      {app.jobTitle && (
        <div className="truncate text-xs text-muted-foreground">{app.jobTitle}</div>
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

export function TrackBoardColumn({
  column,
  readOnly,
  onMove,
  prominent = false,
}: {
  column: BoardColumnView;
  readOnly: boolean;
  onMove?: (appId: string, to: AppStatus) => void;
  prominent?: boolean;
}) {
  const router = useRouter();
  const { feedback, run, dismiss } = useActionFeedback();

  function handleMove(appId: string, to: AppStatus) {
    if (onMove) {
      onMove(appId, to);
      return;
    }
    if (readOnly) return;
    void (async () => {
      const result = await run(() => moveApplicationAction(appId, to));
      if (result.ok) router.refresh();
    })();
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-t-2 border-border bg-card",
        COLUMN_ACCENT[column.status],
        prominent && "shadow-sm ring-1 ring-primary/10",
      )}
    >
      {!prominent && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
            {column.title}
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {column.apps.length}
          </span>
        </div>
      )}
      <div className={cn("space-y-2 px-3 pb-3", prominent && "pt-3")}>
        {column.apps.length === 0 ? (
          <p className="py-2 text-center text-[11px] text-muted-foreground/50">-</p>
        ) : (
          column.apps.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              readOnly={readOnly}
              onMove={handleMove}
            />
          ))
        )}
      </div>
      {feedback && prominent && (
        <div className="px-3 pb-3">
          <ActionFeedback message={feedback} onDismiss={dismiss} />
        </div>
      )}
    </div>
  );
}

export function TrackBoard({
  board,
  readOnly,
  title = "Pipeline",
}: {
  board: BoardColumnView[];
  readOnly: boolean;
  title?: string;
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

  if (board.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-3">
        <h2 className="font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">
          Move cards between stages as your search progresses.
        </p>
      </div>
      <ActionFeedback message={feedback} onDismiss={dismiss} />
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          board.length >= 5 && "sm:grid-cols-2 lg:grid-cols-5",
          board.length === 4 && "sm:grid-cols-2 lg:grid-cols-4",
          board.length === 3 && "sm:grid-cols-2 lg:grid-cols-3",
          board.length <= 2 && "sm:grid-cols-2",
        )}
      >
        {board.map((col) => (
          <TrackBoardColumn
            key={col.status}
            column={col}
            readOnly={readOnly}
            onMove={handleMove}
          />
        ))}
      </div>
    </section>
  );
}
