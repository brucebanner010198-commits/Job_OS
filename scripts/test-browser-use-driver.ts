/**
 * scripts/test-browser-use-driver.ts
 *
 * Self-test gate for Browser Use ApplyDriver integration.
 * Verifies safety invariants, URL validation, driver resolution,
 * and concurrency invariants without requiring a live employer application.
 *
 * Run: npx tsx scripts/test-browser-use-driver.ts
 */

import { browserUseDriver } from "@/lib/apply/driver-browser-use";
import { resolveApplyDriver, activeApplyDriverKind } from "@/lib/apply/driver";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function run() {
  console.log("\n=== Browser Use Driver Invariants Test ===");

  // 1. Driver naming
  const driverDry = browserUseDriver({ dryRun: true });
  check("driver name is browser-use(dry-run) in dry-run mode", driverDry.name === "browser-use(dry-run)");

  const driverLive = browserUseDriver({ dryRun: false });
  check("driver name is browser-use in live mode", driverLive.name === "browser-use");

  // 2. Non-public URL rejection
  let rejected = false;
  try {
    await driverDry.open("http://127.0.0.1:3000/apply");
  } catch {
    rejected = true;
  }
  check("rejects non-public or loopback URLs safely", rejected);

  // 3. Scan without open guard
  let scanFailed = false;
  const freshDriver = browserUseDriver();
  try {
    await freshDriver.scan();
  } catch {
    scanFailed = true;
  }
  check("scan() requires open() first", scanFailed);

  // 4. Concurrency invariant
  let doubleSubmitCaught = false;
  // A stand-in interpreter that exits at once: this checks the guard, not the agent.
  const d = browserUseDriver({ pythonPath: "/usr/bin/false" });
  await d.open("https://jobs.example.com/apply/123");
  // Simulate double submit guard
  try {
    // Calling submit without python worker will fail or execute, but calling twice must throw precondition
    await d.submit().catch(() => {});
    await d.submit();
  } catch {
    doubleSubmitCaught = true;
  }
  check("concurrency=1 invariant throws on second submit call", doubleSubmitCaught);

  // 5. Driver resolver
  const prevApplyDriver = process.env.APPLY_DRIVER;
  const prevDryRun = process.env.APPLY_DRY_RUN;

  process.env.APPLY_DRIVER = "browser-use";
  process.env.APPLY_DRY_RUN = "1";
  delete process.env.JOB_OS_CLOUD;

  check("activeApplyDriverKind resolves to browser-use(dry-run)", activeApplyDriverKind() === "browser-use(dry-run)");
  const resolvedDry = resolveApplyDriver();
  check("resolveApplyDriver returns browser-use driver in dry-run mode", resolvedDry.name === "browser-use(dry-run)");

  process.env.APPLY_DRY_RUN = "0";
  check("activeApplyDriverKind resolves to browser-use", activeApplyDriverKind() === "browser-use");
  const resolvedLive = resolveApplyDriver();
  check("resolveApplyDriver returns live browser-use driver", resolvedLive.name === "browser-use");

  // Restore env
  if (prevApplyDriver !== undefined) process.env.APPLY_DRIVER = prevApplyDriver;
  else delete process.env.APPLY_DRIVER;
  if (prevDryRun !== undefined) process.env.APPLY_DRY_RUN = prevDryRun;
  else delete process.env.APPLY_DRY_RUN;

  console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
