/**
 * Pure scheduler pipeline (Phase 9). Assembles the whole OpsView - scheduled jobs
 * + the catch-up plan + the launchd agent (plist + install steps) + the push-relay
 * status - from explicit inputs, with NO DB. The service calls processOps() with
 * the real watermarks / cwd / now; the /outcomes page falls back to previewOps()
 * when Postgres is unreachable, so the Automation panel always renders.
 */
import {
  jobsFromWatermarks,
  planRun,
  type RunWatermark,
} from "@/lib/scheduler/plan";
import {
  buildLaunchdConfig,
  launchdInstall,
  launchdPlistPath,
  renderLaunchdPlist,
} from "@/lib/scheduler/launchd";
import { pushRelayStatus } from "@/lib/scheduler/push-relay";
import {
  fixtureWatermarks,
  FIXTURE_CWD,
  FIXTURE_NOW,
} from "@/lib/scheduler/fixtures";
import type { OpsView } from "@/lib/scheduler/types";

/** Build the OpsView from explicit inputs (pure). */
export function processOps(input: {
  watermarks: RunWatermark[];
  cwd: string;
  nowIso: string;
  launchdInstalled?: boolean;
}): OpsView {
  const jobs = jobsFromWatermarks(input.watermarks);
  const plan = planRun(jobs, input.nowIso);

  const config = buildLaunchdConfig({ workingDirectory: input.cwd });
  const launchd = {
    label: config.label,
    intervalSec: config.intervalSec,
    installed: input.launchdInstalled ?? false,
    plistPath: launchdPlistPath(config.label),
    plist: renderLaunchdPlist(config),
    install: launchdInstall(config),
  };

  return {
    jobs,
    plan,
    launchd,
    pushRelay: pushRelayStatus(),
  };
}

/** Offline preview: the Automation panel computed from fixtures at a fixed NOW. */
export function previewOps(): OpsView {
  return processOps({
    watermarks: fixtureWatermarks,
    cwd: FIXTURE_CWD,
    nowIso: FIXTURE_NOW,
  });
}
