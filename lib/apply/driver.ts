/**
 * Apply-driver resolver (Phase 10). Picks which ApplyDriver approveAndSubmit
 * uses, keeping the SIMULATED adapter the safe default and activating the real
 * Playwright adapter only when explicitly opted in AND running locally:
 *
 *   APPLY_DRIVER=playwright   → real system-Chrome driver (local only)
 *   APPLY_DRY_RUN=1           → fill the form but never click submit
 *   JOB_OS_CLOUD=1            → force simulated (autonomy/automation auto-disables
 *                               on cloud - the browser hands must stay local)
 *
 * Anything else → simulated. This is the one place the env→driver decision lives,
 * so call sites never branch.
 */
import { simulatedDriver } from "@/lib/apply/driver-simulated";
import { playwrightDriver } from "@/lib/apply/driver-playwright";
import type { ApplyDriver } from "@/lib/apply/types";

export type ApplyDriverKind = "simulated" | "playwright" | "playwright(dry-run)";

/** Which driver the current env would select (for status display / logging). */
export function activeApplyDriverKind(): ApplyDriverKind {
  const wantPlaywright =
    process.env.APPLY_DRIVER === "playwright" && process.env.JOB_OS_CLOUD !== "1";
  if (!wantPlaywright) return "simulated";
  return process.env.APPLY_DRY_RUN === "1" ? "playwright(dry-run)" : "playwright";
}

export function resolveApplyDriver(opts?: { failSubmit?: boolean }): ApplyDriver {
  const kind = activeApplyDriverKind();
  if (kind === "simulated") {
    return simulatedDriver({ failSubmit: opts?.failSubmit ?? false });
  }
  return playwrightDriver({ dryRun: kind === "playwright(dry-run)" });
}
