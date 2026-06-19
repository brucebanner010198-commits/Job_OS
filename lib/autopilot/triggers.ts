/**
 * Setup-complete trigger — runs discover-jobs + autopilot-cycle immediately
 * (same jobs the catch-up runner would run, without waiting for the next wake).
 */
import type { AppScope } from "@/lib/profiles/types";
import { recordRun } from "@/lib/scheduler/service";
import { runScheduledJob } from "@/lib/scheduler/run-job";
import type { JobKind } from "@/lib/scheduler/types";

const SETUP_CATCHUP_JOBS: JobKind[] = ["discover-jobs", "autopilot-cycle"];

let catchupRunning = false;

export function isSetupCatchupRunning(): boolean {
  return catchupRunning;
}

/** Run discovery + autopilot cycle and advance watermarks. */
export async function onSetupComplete(scope: AppScope): Promise<void> {
  catchupRunning = true;
  try {
    for (const kind of SETUP_CATCHUP_JOBS) {
      try {
        const { status, detail } = await runScheduledJob(scope, kind);
        await recordRun(scope, kind, status, detail);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await recordRun(scope, kind, "failed", message).catch(() => {});
        console.error(`[setup-catchup] ${kind}:`, message);
      }
    }
  } finally {
    catchupRunning = false;
  }
}

/** Fire-and-forget — call from server actions via next/server after(). */
export function scheduleSetupCatchup(scope: AppScope): void {
  void onSetupComplete(scope).catch((err) => {
    console.error("[setup-catchup]", err);
  });
}
