/**
 * Kanban board projection (Phase 6, plan §8d) - pure view-model builder that
 * turns a flat list of applications into the ordered, per-status columns the
 * /track board renders. No DB, no network, no LLM, no wall-clock reads.
 *
 * Column order is owned by BOARD_COLUMNS in types.ts (the single source of
 * truth); SKIPPED is intentionally absent from that list and therefore never
 * gets a column here, though it still has a human-readable title for badges.
 */
import type { AppStatus, AppRef } from "@/lib/track/types";
import { BOARD_COLUMNS } from "@/lib/track/types";

/** Human-readable column/status labels for every AppStatus (SKIPPED included). */
export const COLUMN_TITLES: Record<AppStatus, string> = {
  WARM_PATH: "Warm path",
  TO_APPLY: "To apply",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  SKIPPED: "Skipped",
};

/** One rendered Kanban column: a status, its title, and its apps in order. */
export interface BoardColumn {
  status: AppStatus;
  title: string;
  apps: AppRef[];
}

/**
 * Build the board: one column per status in BOARD_COLUMNS (left → right,
 * SKIPPED excluded). Apps are filtered into their column preserving the input
 * order, and each column's title comes from COLUMN_TITLES.
 */
export function buildBoard(apps: AppRef[]): BoardColumn[] {
  return BOARD_COLUMNS.map((status) => ({
    status,
    title: COLUMN_TITLES[status],
    apps: apps.filter((app) => app.status === status),
  }));
}

/**
 * True when an app may be dragged from `from` to `to`: both must be real board
 * columns (present in BOARD_COLUMNS, so SKIPPED is not a drop target) and the
 * move must be an actual change of column.
 */
export function canMove(from: AppStatus, to: AppStatus): boolean {
  return (
    from !== to &&
    BOARD_COLUMNS.includes(from) &&
    BOARD_COLUMNS.includes(to)
  );
}
