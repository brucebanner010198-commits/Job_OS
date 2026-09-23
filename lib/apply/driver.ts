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
 * Anything else → simulated. When a real driver is chosen and the job is a
 * hosted Greenhouse form, the Greenhouse driver fills it by field id instead.
 * This is the one place the env→driver decision lives, so call sites never branch.
 */
import { simulatedDriver } from "@/lib/apply/driver-simulated";
import { playwrightDriver } from "@/lib/apply/driver-playwright";
import { browserUseDriver } from "@/lib/apply/driver-browser-use";
import { greenhouseDriver } from "@/lib/apply/driver-greenhouse";
import { parseGreenhouseJobUrl } from "@/lib/apply/greenhouse";
import type { ApplyDriver } from "@/lib/apply/types";

export type ApplyDriverKind =
  | "simulated"
  | "playwright"
  | "playwright(dry-run)"
  | "browser-use"
  | "browser-use(dry-run)";

/** Which driver the current env would select (for status display / logging). */
export function activeApplyDriverKind(): ApplyDriverKind {
  if (process.env.JOB_OS_CLOUD === "1") return "simulated";

  if (process.env.APPLY_DRIVER === "browser-use") {
    return process.env.APPLY_DRY_RUN === "0" ? "browser-use" : "browser-use(dry-run)";
  }

  const wantPlaywright = process.env.APPLY_DRIVER === "playwright";
  if (!wantPlaywright) return "simulated";
  return process.env.APPLY_DRY_RUN === "1" ? "playwright(dry-run)" : "playwright";
}

export function resolveApplyDriver(opts?: { failSubmit?: boolean; url?: string }): ApplyDriver {
  const kind = activeApplyDriverKind();
  if (kind === "simulated") {
    return simulatedDriver({ failSubmit: opts?.failSubmit ?? false });
  }
  // Greenhouse never submits on its own, so dry-run and live behave the same.
  if (opts?.url && parseGreenhouseJobUrl(opts.url)) {
    return greenhouseDriver();
  }
  if (kind === "browser-use" || kind === "browser-use(dry-run)") {
    return browserUseDriver({
      dryRun: kind === "browser-use(dry-run)",
      headless: process.env.APPLY_HEADLESS !== "0",
    });
  }
  return playwrightDriver({ dryRun: kind === "playwright(dry-run)" });
}
