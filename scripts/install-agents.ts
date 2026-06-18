/**
 * launchd agent installer (Phase 12) - `npm run install:agents`. Installs the
 * two background agents (catch-up + daily backup) so the app keeps itself current
 * whenever the Mac is awake. SAFE BY DEFAULT: with no flags it only PRINTS the
 * plists + the exact paths/commands (no system change). Flags:
 *
 *   npm run install:agents            # print the plists + commands (dry run)
 *   npm run install:agents -- --write # write the .plist files to ~/Library/LaunchAgents
 *   npm run install:agents -- --load  # write AND launchctl load them
 *
 * Honors LAUNCH_AGENTS_DIR (defaults to ~/Library/LaunchAgents) so it can be
 * pointed at a temp dir for testing.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { buildAgentPlists } from "@/lib/scheduler/agents";

const run = promisify(execFile);

function agentsDir(): string {
  return (
    process.env.LAUNCH_AGENTS_DIR ??
    path.join(os.homedir(), "Library", "LaunchAgents")
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const doWrite = args.includes("--write") || args.includes("--load");
  const doLoad = args.includes("--load");

  const cwd = process.cwd();
  const agents = buildAgentPlists(cwd);
  const dir = agentsDir();

  for (const a of agents) {
    const target = path.join(dir, `${a.label}.plist`);
    console.log(`\n• ${a.label}  (every ${a.intervalSec}s → npm run ${a.npmScript})`);
    console.log(`  path: ${target}`);

    if (!doWrite) {
      console.log("  (dry run - re-run with --write to install, --load to load)");
      continue;
    }

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(target, a.plist, "utf8");
    console.log("  ✓ written");

    if (doLoad) {
      try {
        await run("launchctl", ["unload", target]).catch(() => {});
        await run("launchctl", ["load", target]);
        console.log("  ✓ loaded");
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ launchctl load failed: ${msg}`);
      }
    }
  }

  if (!doWrite) {
    console.log("\nNothing was changed. Add --write (or --load) to install.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[install-agents] fatal:", err);
    process.exit(1);
  });
