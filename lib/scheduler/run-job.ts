/**
 * Shared catch-up job runner — used by scripts/run-catchup.ts and setup triggers.
 */
import { syncInbox } from "@/lib/track/service";
import { ingestAndScore } from "@/lib/jobs/service";
import { getFollowUpViews } from "@/lib/followup/service";
import { runCareerContentAgent } from "@/lib/career/agent";
import {
  runAutopilotCycle,
  recordAutopilotRun,
  discoveryQueryForUser,
} from "@/lib/autopilot/orchestrator";
import type { AppScope } from "@/lib/profiles/types";
import type { JobKind, RunStatus } from "@/lib/scheduler/types";

/** Run one scheduled job, returning a status + a short human detail for the watermark. */
export async function runScheduledJob(
  scope: AppScope,
  kind: JobKind,
): Promise<{ status: RunStatus; detail: string }> {
  switch (kind) {
    case "gmail-sync": {
      const r = await syncInbox(scope);
      return {
        status: "ok",
        detail: `synced ${r.created} new, ${r.proposals} proposals (${r.source})`,
      };
    }
    case "discover-jobs": {
      const query = await discoveryQueryForUser(scope);
      const r = await ingestAndScore(scope, query);
      return {
        status: "ok",
        detail: `ingested ${r.ingested}, kept ${r.kept}, filtered ${r.filtered}`,
      };
    }
    case "refresh-followups": {
      const views = await getFollowUpViews(scope);
      return {
        status: "ok",
        detail: `recomputed follow-ups for ${views.length} application(s)`,
      };
    }
    case "refresh-career-content": {
      const r = await runCareerContentAgent(scope);
      return { status: "ok", detail: r.detail };
    }
    case "autopilot-cycle": {
      if (process.env.AUTOPILOT_ENABLED === "0") {
        return { status: "skipped", detail: "autopilot disabled" };
      }
      const r = await runAutopilotCycle(scope);
      recordAutopilotRun(r);
      return {
        status: "ok",
        detail:
          `briefed ${r.briefed}, prepared ${r.prepared}, auto-submitted ${r.autoSubmitted}, ` +
          `review-stopped ${r.stoppedAtReview}`,
      };
    }
  }
}
