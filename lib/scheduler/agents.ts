/**
 * launchd agent set (Phase 12) - PURE. Builds the plists for BOTH background
 * agents Job OS schedules, by reusing the Phase 9 pure generator:
 *   - com.jobos.catchup  → `npm run catchup` (Gmail/discovery/follow-ups), 30m
 *   - com.jobos.backup   → `npm run backup`  (encrypted profile snapshot), daily
 *
 * The desktop app's installer (scripts/install-agents.ts) writes + loads these;
 * keeping the generation pure makes it gate-testable with no filesystem.
 */
import {
  buildLaunchdConfig,
  renderLaunchdPlist,
  launchdInstall,
  launchdPlistPath,
} from "@/lib/scheduler/launchd";
import {
  DEFAULT_LAUNCHD_LABEL,
  DEFAULT_LAUNCHD_INTERVAL_SEC,
} from "@/lib/scheduler/types";
import { BACKUP_INTERVAL_SEC } from "@/lib/backup/types";

export interface AgentPlist {
  label: string;
  npmScript: string;
  intervalSec: number;
  plistPath: string;
  plist: string;
  install: string[];
}

export function buildAgentPlists(cwd: string): AgentPlist[] {
  const specs = [
    {
      label: DEFAULT_LAUNCHD_LABEL,
      npmScript: "catchup",
      intervalSec: DEFAULT_LAUNCHD_INTERVAL_SEC,
      logPath: `${cwd}/.logs/catchup.log`,
    },
    {
      label: "com.jobos.backup",
      npmScript: "backup",
      intervalSec: BACKUP_INTERVAL_SEC,
      logPath: `${cwd}/.backups/backup.log`,
    },
  ];
  return specs.map((s) => {
    const cfg = buildLaunchdConfig({
      workingDirectory: cwd,
      label: s.label,
      intervalSec: s.intervalSec,
      npmScript: s.npmScript,
      logPath: s.logPath,
    });
    return {
      label: cfg.label,
      npmScript: s.npmScript,
      intervalSec: cfg.intervalSec,
      plistPath: launchdPlistPath(cfg.label),
      plist: renderLaunchdPlist(cfg),
      install: launchdInstall(cfg),
    };
  });
}
