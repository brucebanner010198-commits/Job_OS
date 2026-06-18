/**
 * launchd agent generator (Phase 9, plan §9). Pure string builders - no DB, no
 * I/O. Renders a macOS launchd property list that runs the catch-up runner on a
 * cadence AND on wake, plus the copy-paste commands to install it.
 *
 * Why launchd (not node-cron): node-cron silently drops every run that was
 * scheduled while the laptop was asleep. launchd's RunAtLoad fires the agent the
 * moment the machine wakes, and the pure planner then runs only what's actually
 * due - so "catch up since last run" is honest. This is the local half of the
 * "cloud brain + local hands" architecture.
 */
import type { LaunchdConfig } from "@/lib/scheduler/types";
import {
  DEFAULT_LAUNCHD_INTERVAL_SEC,
  DEFAULT_LAUNCHD_LABEL,
} from "@/lib/scheduler/types";

/** Escape the five XML entities for safe inclusion in a plist <string>. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build a launchd config for the catch-up runner from the repo working directory.
 * The agent runs the runner through a login shell (`/bin/sh -lc`) so the user's
 * PATH (node/npm/tsx) resolves the same way it does in their terminal - the most
 * common reason a hand-written launchd agent silently fails.
 */
export function buildLaunchdConfig(opts: {
  workingDirectory: string;
  label?: string;
  intervalSec?: number;
  /** npm script that runs scripts/run-catchup.ts (defaults to "catchup"). */
  npmScript?: string;
  logPath?: string;
  runAtLoad?: boolean;
}): LaunchdConfig {
  const wd = opts.workingDirectory;
  const npmScript = opts.npmScript ?? "catchup";
  return {
    label: opts.label ?? DEFAULT_LAUNCHD_LABEL,
    programPath: "/bin/sh",
    programArgs: ["-lc", `cd '${wd}' && npm run ${npmScript}`],
    intervalSec: opts.intervalSec ?? DEFAULT_LAUNCHD_INTERVAL_SEC,
    workingDirectory: wd,
    logPath: opts.logPath ?? `${wd}/.logs/catchup.log`,
    runAtLoad: opts.runAtLoad ?? true,
  };
}

/** Render the launchd .plist XML for a config. */
export function renderLaunchdPlist(config: LaunchdConfig): string {
  const args = [config.programPath, ...config.programArgs]
    .map((a) => `    <string>${escapeXml(a)}</string>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${escapeXml(config.label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>StartInterval</key>
  <integer>${Math.round(config.intervalSec)}</integer>
  <key>RunAtLoad</key>
  <${config.runAtLoad ? "true" : "false"}/>
  <key>WorkingDirectory</key>
  <string>${escapeXml(config.workingDirectory)}</string>
  <key>StandardOutPath</key>
  <string>${escapeXml(config.logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${escapeXml(config.logPath)}</string>
</dict>
</plist>
`;
}

/** Where the agent's plist is installed. */
export function launchdPlistPath(label: string): string {
  return `~/Library/LaunchAgents/${label}.plist`;
}

/**
 * The copy-paste install sequence. Step 2 is a placeholder the UI pairs with the
 * rendered plist text (the user saves it to the shown path), then loads it.
 */
export function launchdInstall(config: LaunchdConfig): string[] {
  const plistPath = launchdPlistPath(config.label);
  return [
    "mkdir -p ~/Library/LaunchAgents",
    `# Save the plist below to ${plistPath}`,
    `launchctl unload ${plistPath} 2>/dev/null || true`,
    `launchctl load ${plistPath}`,
    `# Verify it's registered:`,
    `launchctl list | grep ${config.label}`,
  ];
}
