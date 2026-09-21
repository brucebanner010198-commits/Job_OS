/**
 * Test suite for Google canonical error architecture, safe action wrappers, and system diagnostics.
 * Run: npm run test:diagnostics
 */

import { JobOSError } from "@/lib/errors/job-os-error";
import { HTTP_STATUS_TO_CANONICAL } from "@/lib/errors/canonical-codes";
import { safeAction, unwrapActionResult } from "@/lib/errors/action-handler";
import { runSystemDiagnostics } from "@/lib/diagnostics/system-health";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function main() {
  console.log("\n1. Testing JobOSError structure and canonical mappings:");

  check("HTTP 400 maps to INVALID_ARGUMENT", HTTP_STATUS_TO_CANONICAL[400] === "INVALID_ARGUMENT");
  check("HTTP 404 maps to NOT_FOUND", HTTP_STATUS_TO_CANONICAL[404] === "NOT_FOUND");
  check("HTTP 503 maps to UNAVAILABLE", HTTP_STATUS_TO_CANONICAL[503] === "UNAVAILABLE");
  check("HTTP 429 maps to RESOURCE_EXHAUSTED", HTTP_STATUS_TO_CANONICAL[429] === "RESOURCE_EXHAUSTED");

  const err = JobOSError.invalidArgument({
    domain: "job_os.test",
    reason: "TEST_REASON",
    location: "test-diagnostics.ts:main",
    message: "Test invalid argument error.",
    remedy: "Provide valid inputs to fix this.",
    metadata: { key: "value", count: 42 },
  });

  check("JobOSError is instanceof Error", err instanceof Error);
  check("JobOSError has correct code", err.code === "INVALID_ARGUMENT");
  check("JobOSError has correct domain", err.domain === "job_os.test");
  check("JobOSError has correct reason", err.reason === "TEST_REASON");
  check("JobOSError has location", err.location === "test-diagnostics.ts:main");
  check("JobOSError has remedy", err.remedy === "Provide valid inputs to fix this.");
  check("JobOSError has generated traceId", err.traceId.startsWith("trace_"));

  const payload = err.toPayload();
  check("toPayload contains code", payload.code === "INVALID_ARGUMENT");
  check("toPayload contains traceId", payload.traceId === err.traceId);
  check("toPayload contains metadata", payload.metadata?.count === 42);

  const report = err.toDiagnosticReport();
  check("toDiagnosticReport includes Trace ID", report.includes(`Trace ID:    ${err.traceId}`));
  check("toDiagnosticReport includes Subsystem", report.includes("Subsystem:   job_os.test"));
  check("toDiagnosticReport includes Remedy", report.includes("Remedy:      Provide valid inputs"));

  console.log("\n2. Testing JobOSError wrapping:");

  const standardErr = new Error("Connection timed out");
  const wrapped = JobOSError.wrap(standardErr, {
    domain: "job_os.network",
    location: "test-diagnostics.ts:networkCall",
    fallbackReason: "NETWORK_TIMEOUT",
    remedy: "Check network connection.",
  });

  check("Wrapped error is instanceof JobOSError", wrapped instanceof JobOSError);
  check("Wrapped error has cause preserved", wrapped.cause === standardErr);
  check("Wrapped error has location", wrapped.location === "test-diagnostics.ts:networkCall");
  check("Wrapped error preserves message", wrapped.message === "Connection timed out");

  const alreadyJobError = JobOSError.wrap(err, {
    domain: "other",
    location: "other",
  });
  check("Wrapping existing JobOSError returns same instance", alreadyJobError === err);

  console.log("\n3. Testing safeAction wrapper:");

  const successResult = await safeAction(
    { domain: "job_os.action", location: "test:successAction" },
    async () => {
      return { id: "item_123" };
    },
  );

  check("safeAction succeeds on normal completion", successResult.ok === true);
  if (successResult.ok) {
    check("safeAction returns expected data", successResult.data.id === "item_123");
    check("unwrapActionResult returns data", unwrapActionResult(successResult).id === "item_123");
  }

  const failureResult = await safeAction(
    { domain: "job_os.action", location: "test:failureAction" },
    async () => {
      throw JobOSError.notFound({
        domain: "job_os.action",
        reason: "TARGET_MISSING",
        location: "test:failureAction",
        message: "Target target_404 does not exist.",
        remedy: "Create target first.",
      });
    },
  );

  check("safeAction traps error cleanly", failureResult.ok === false);
  if (!failureResult.ok) {
    check("safeAction payload has NOT_FOUND code", failureResult.error.code === "NOT_FOUND");
    check("safeAction payload has traceId", failureResult.error.traceId.startsWith("trace_"));
    check("safeAction payload has remedy", failureResult.error.remedy === "Create target first.");
  }

  console.log("\n4. Testing system diagnostics execution:");

  const diagReport = await runSystemDiagnostics();
  check("System diagnostics produces overallStatus", ["healthy", "degraded", "unhealthy"].includes(diagReport.overallStatus));
  check("System diagnostics runs 5 subsystem probes", diagReport.checks.length === 5);
  check("Database probe executed", diagReport.checks.some((c) => c.subsystem === "job_os.db"));
  check("Storage probe executed", diagReport.checks.some((c) => c.subsystem === "job_os.storage"));
  check("Secrets probe executed", diagReport.checks.some((c) => c.subsystem === "job_os.auth"));
  check("AI probe executed", diagReport.checks.some((c) => c.subsystem === "job_os.ai"));
  check("System environment probe executed", diagReport.checks.some((c) => c.subsystem === "job_os.system"));

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
