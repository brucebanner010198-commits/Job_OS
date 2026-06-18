/**
 * Deterministic scheduler corpus for Phase 9. Used by the catch-up test gate and
 * the offline /outcomes "Automation" preview. A constant NOW is injected, so
 * due/not-due decisions are fully deterministic.
 *
 * The five jobs are placed in the states that matter:
 *   - gmail-sync            → never run            → DUE
 *   - discover-jobs         → ran 1h ago (< 6h)    → NOT due (idempotent: don't re-run)
 *   - refresh-followups     → ran 48h ago (> 12h)  → DUE (overdue - missed during sleep)
 *   - refresh-career-content→ never run            → DUE
 *   - autopilot-cycle       → never run            → DUE
 */
import type { RunWatermark } from "@/lib/scheduler/plan";
import type { JobKind } from "@/lib/scheduler/types";

/** The constant "now" tests inject (matches the fixture build date). */
export const FIXTURE_NOW = "2026-06-16T12:00:00.000Z";

/** A placeholder repo path for the offline launchd preview. */
export const FIXTURE_CWD = "/Users/you/Job_OS";

export const fixtureWatermarks: RunWatermark[] = [
  // Never run → due now.
  { kind: "gmail-sync", runs: 0 },
  // Ran 1h ago; interval is 6h → not due yet (re-running would be wasteful).
  {
    kind: "discover-jobs",
    lastRunAt: "2026-06-16T11:00:00.000Z",
    lastStatus: "ok",
    lastDetail: "ingested 18, kept 12",
    runs: 7,
  },
  // Ran 48h ago; interval is 12h → overdue (the machine was asleep).
  {
    kind: "refresh-followups",
    lastRunAt: "2026-06-14T12:00:00.000Z",
    lastStatus: "ok",
    lastDetail: "3 nudges due",
    runs: 4,
  },
  // Never run → due now.
  { kind: "refresh-career-content", runs: 0 },
  { kind: "autopilot-cycle", runs: 0 },
];

/** Ground-truth the test gate asserts against. */
export const EXPECTED_DUE: JobKind[] = [
  "gmail-sync",
  "refresh-followups",
  "refresh-career-content",
  "autopilot-cycle",
];
export const EXPECTED_NOT_DUE: JobKind[] = ["discover-jobs"];
