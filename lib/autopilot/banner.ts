/**
 * Autopilot banner view model — slim status for active pipeline stages.
 */
import { listApplications } from "@/lib/apply/service";
import { loadWatermarks } from "@/lib/scheduler/service";
import { humanizeDuration } from "@/lib/scheduler/plan";
import { autopilotStatus } from "@/lib/autopilot/orchestrator";
import { isSetupCatchupRunning } from "@/lib/autopilot/triggers";
import type { AppScope } from "@/lib/profiles/types";

export interface AutopilotBannerData {
  enabled: boolean;
  running: boolean;
  recentlyRan: boolean;
  reviewCount: number;
  /** One-line status for the slim banner. */
  line: string;
}

const RECENT_RUN_SEC = 30 * 60;

export async function getAutopilotBannerData(
  scope: AppScope,
  setupComplete: boolean,
): Promise<AutopilotBannerData | null> {
  const enabled = process.env.AUTOPILOT_ENABLED !== "0";
  if (!enabled || !setupComplete) return null;

  const [watermarks, apps] = await Promise.all([
    loadWatermarks(scope),
    listApplications(scope),
  ]);

  const autopilotWm = watermarks.find((w) => w.kind === "autopilot-cycle");
  const lastRunAt = autopilotWm?.lastRunAt;
  const nowMs = Date.now();
  const ageSec = lastRunAt
    ? Math.max(0, (nowMs - Date.parse(lastRunAt)) / 1000)
    : undefined;
  const recentlyRan = ageSec !== undefined && ageSec < RECENT_RUN_SEC;
  const running = isSetupCatchupRunning();

  const reviewCount = apps.filter((a) => a.applyState === "REVIEW").length;

  let line: string;
  if (running) {
    line = "Autopilot running — discovering roles and preparing applications";
  } else if (!lastRunAt) {
    line = "Autopilot on — awaiting first run";
  } else if (recentlyRan) {
    const detail = autopilotWm?.lastDetail;
    line = detail
      ? `Autopilot on · last run ${humanizeDuration(ageSec!)} ago · ${detail}`
      : `Autopilot on · last run ${humanizeDuration(ageSec!)} ago`;
  } else {
    line = autopilotStatus().summary;
  }

  if (reviewCount > 0) {
    line += ` · ${reviewCount} awaiting review`;
  }

  return {
    enabled: true,
    running,
    recentlyRan: running || recentlyRan,
    reviewCount,
    line,
  };
}
