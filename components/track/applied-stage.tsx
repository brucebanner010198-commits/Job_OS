/**
 * Applied stage composition (plan §5.4) — inbox proposals + Applied kanban column
 * in one focused view. Proposals sit above the Applied column; the rest of the
 * pipeline board renders below without duplicating Applied.
 */
"use client";

import { InboxProposals } from "@/components/track/inbox-proposals";
import { TrackBoardColumn } from "@/components/track/track-board";
import type { AppStatus, BoardColumnView, ProposalView } from "@/lib/track/types";

export function AppliedStageCompose({
  proposals,
  appliedColumn,
  readOnly,
}: {
  proposals: ProposalView[];
  appliedColumn: BoardColumnView | undefined;
  readOnly: boolean;
}) {
  const appliedCount = appliedColumn?.apps.length ?? 0;

  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight">Applied</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What&apos;s in flight — confirm Gmail-detected updates, then track submitted
          applications waiting for a response.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <InboxProposals proposals={proposals} readOnly={readOnly} compact />
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
              Applied column
            </h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] tabular-nums text-muted-foreground">
              {appliedCount}
            </span>
          </div>
          {appliedColumn ? (
            <TrackBoardColumn
              column={appliedColumn}
              readOnly={readOnly}
              prominent
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
              No applications in Applied yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function splitBoardForAppliedStage(board: BoardColumnView[]): {
  appliedColumn: BoardColumnView | undefined;
  restBoard: BoardColumnView[];
} {
  const appliedColumn = board.find((col) => col.status === ("APPLIED" satisfies AppStatus));
  const restBoard = board.filter((col) => col.status !== "APPLIED");
  return { appliedColumn, restBoard };
}
