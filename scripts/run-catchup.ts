/**
 * Catch-up runner (Phase 9, plan §9) - the script the macOS launchd agent invokes
 * (`npm run catchup`) on wake and on its interval. It is the local half of "cloud
 * brain + local hands": it asks the pure planner which recurring jobs are DUE
 * since they last ran, runs ONLY those, and advances each watermark so the same
 * wake never double-runs a job. Everything is idempotent and fail-safe - a job
 * that throws is recorded as failed and the others still run.
 *
 * It NEVER weakens a safety guarantee: gmail-sync only PROPOSES status changes,
 * discovery only ingests/scores (never auto-applies), and follow-ups are drafts.
 *
 * Run manually:  npm run catchup
 */
import { getPrimaryUser } from "@/lib/user";
import { resolveScope } from "@/lib/profiles/scope";
import { loadWatermarks, recordRun } from "@/lib/scheduler/service";
import { jobsFromWatermarks, planRun } from "@/lib/scheduler/plan";
import { runScheduledJob } from "@/lib/scheduler/run-job";

async function main(): Promise<void> {
  const user = await getPrimaryUser();
  const scope = await resolveScope(user.id);
  const nowIso = new Date().toISOString();

  const watermarks = await loadWatermarks(scope);
  const jobs = jobsFromWatermarks(watermarks);
  const plan = planRun(jobs, nowIso);

  console.log(`[catchup] ${nowIso}`);
  for (const d of plan.decisions) {
    console.log(`  • ${d.kind}: ${d.due ? "DUE" : "skip"} - ${d.reason}`);
  }

  if (plan.dueKinds.length === 0) {
    console.log("[catchup] nothing due - up to date.");
    return;
  }

  for (const kind of plan.dueKinds) {
    try {
      const { status, detail } = await runScheduledJob(scope, kind);
      await recordRun(scope, kind, status, detail);
      console.log(`  ✓ ${kind}: ${detail}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Fail-safe: record the failure and keep going; the watermark advances so
      // a hard-failing job doesn't wedge the whole run, and it retries next wake.
      await recordRun(scope, kind, "failed", message).catch(() => {});
      console.error(`  ✗ ${kind}: ${message}`);
    }
  }

  console.log(`[catchup] ran ${plan.dueKinds.length} job(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[catchup] fatal:", err);
    process.exit(1);
  });
