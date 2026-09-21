/**
 * System diagnostics CLI tool.
 * Runs all subsystem diagnostic probes and prints actionable failure reports.
 *
 * Run: npm run diagnose
 */

import { runSystemDiagnostics } from "@/lib/diagnostics/system-health";

async function main() {
  console.log("\nRunning Job OS system diagnostics...\n");

  const report = await runSystemDiagnostics();

  console.log(`Overall status: ${report.overallStatus.toUpperCase()} (${report.durationMs}ms)\n`);

  for (const check of report.checks) {
    const symbol = check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗";
    const latency = check.latencyMs !== undefined ? ` [${check.latencyMs}ms]` : "";
    console.log(`${symbol} ${check.name} (${check.subsystem}): ${check.status.toUpperCase()}${latency}`);
    console.log(`  Message: ${check.message}`);

    if (check.location) {
      console.log(`  Location: ${check.location}`);
    }

    if (check.remedy) {
      console.log(`  Remedy: ${check.remedy}`);
    }

    if (check.details) {
      console.log(`  Details: ${JSON.stringify(check.details)}`);
    }

    console.log("");
  }

  if (report.overallStatus === "unhealthy") {
    console.error("System diagnostics detected critical failures. Review the remedies above.\n");
    process.exit(1);
  } else if (report.overallStatus === "degraded") {
    console.log("System diagnostics passed with warnings. Review the warnings above.\n");
    process.exit(0);
  } else {
    console.log("All subsystem diagnostic probes passed.\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});
