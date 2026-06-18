/**
 * Autopilot orchestrator - chains discover → score → brief → prepare → apply.
 * Auto-submits AUTONOMOUS-route jobs only; ASSISTED/MANUAL stop at REVIEW.
 */
import { ingestAndScore, listQueue } from "@/lib/jobs/service";
import { getGoal, nonSensitiveProfileText } from "@/lib/goals/service";
import {
  prepareApplication,
  approveAndSubmit,
  listApplications,
} from "@/lib/apply/service";
import { ensureBrief } from "@/lib/brief/service";
import { mayAutoSubmit, mustStopAtReview, DEFAULT_AUTOPILOT_POLICY } from "@/lib/autopilot/policy";
import { evaluateQualityGate } from "@/lib/autopilot/quality-gate";
import { computeAtsMatch } from "@/lib/scoring/ats-keywords";
import { indexUserKnowledge } from "@/lib/knowledge/index";
import type { AppScope } from "@/lib/profiles/types";

export interface AutopilotRunResult {
  discovered: { ingested: number; kept: number };
  knowledgeChunks: number;
  briefed: number;
  prepared: number;
  autoSubmitted: number;
  stoppedAtReview: number;
  details: string[];
}

function domainFromJobUrl(url: string | null): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Build a goal-aware discovery query. */
export async function discoveryQueryForUser(scope: AppScope): Promise<string> {
  const fallback = process.env.JOBS_DEFAULT_QUERY ?? "software engineer";
  try {
    const goal = await getGoal(scope);
    if (!goal) return fallback;
    const titles = goal.targetTitles.slice(0, 2).join(" OR ");
    return titles || goal.northStar || fallback;
  } catch {
    return fallback;
  }
}

/**
 * One autopilot catch-up cycle for a profile.
 */
export async function runAutopilotCycle(scope: AppScope): Promise<AutopilotRunResult> {
  const details: string[] = [];
  const query = await discoveryQueryForUser(scope);
  details.push(`discovery query: ${query}`);

  const resumeText = await nonSensitiveProfileText(scope);

  const discovery = await ingestAndScore(scope, query);
  details.push(`ingested ${discovery.ingested}, kept ${discovery.kept}`);

  const { chunks } = await indexUserKnowledge(scope);
  details.push(`indexed ${chunks} knowledge chunks`);

  const queue = await listQueue(scope);
  const top = queue.slice(0, DEFAULT_AUTOPILOT_POLICY.topJobsToBrief);

  let briefed = 0;
  let prepared = 0;
  let autoSubmitted = 0;
  let stoppedAtReview = 0;

  for (const job of top) {
    try {
      await ensureBrief(scope, {
        name: job.company,
        domain: domainFromJobUrl(job.url),
      });
      briefed++;
      details.push(`brief ensured: ${job.company}`);

      await prepareApplication(scope, job.id);
      prepared++;

      const apps = await listApplications(scope);
      const app = apps.find(
        (a) => a.jobTitle === job.title && a.company === job.company,
      );
      const route = app?.route;
      if (!route) continue;

      if (mustStopAtReview(route)) {
        stoppedAtReview++;
        details.push(`REVIEW gate: ${job.title} @ ${job.company} (${route})`);
        continue;
      }

      if (mayAutoSubmit(route) && app?.applyState === "REVIEW") {
        const jd = job.description ?? "";
        const keywordMatch = jd
          ? computeAtsMatch(jd, resumeText).matchPercent
          : undefined;
        const gate = evaluateQualityGate({
          jobScore: job.score,
          route,
          hardGatePass: job.hardGatePass,
          keywordMatchPercent: keywordMatch,
          dailyAutoCount: autoSubmitted,
        });
        if (!gate.canAutoSubmit) {
          stoppedAtReview++;
          details.push(
            `quality gate: ${job.title} @ ${job.company} - ${gate.reasons[0] ?? gate.verdict}`,
          );
          continue;
        }
        const result = await approveAndSubmit(scope, app.id);
        if (result.ok) {
          autoSubmitted++;
          details.push(`auto-submitted: ${job.title} @ ${job.company}`);
        }
      }
    } catch (e) {
      details.push(
        `skip ${job.title}: ${e instanceof Error ? e.message : "error"}`,
      );
    }
  }

  return {
    discovered: { ingested: discovery.ingested, kept: discovery.kept },
    knowledgeChunks: chunks,
    briefed,
    prepared,
    autoSubmitted,
    stoppedAtReview,
    details,
  };
}

export interface AutopilotStatus {
  enabled: boolean;
  lastRun?: string;
  summary: string;
}

let lastRunSummary: string | null = null;

function defaultAutopilotSummary(enabled: boolean): string {
  return enabled
    ? "Autopilot enabled. Awaiting next scheduled run."
    : "Autopilot disabled.";
}

export function autopilotStatus(): AutopilotStatus {
  const enabled = process.env.AUTOPILOT_ENABLED !== "0";
  return {
    enabled,
    summary: lastRunSummary ?? defaultAutopilotSummary(enabled),
  };
}

export function recordAutopilotRun(result: AutopilotRunResult): void {
  lastRunSummary =
    `Last run: ${result.discovered.kept} jobs retained, ${result.briefed} briefed, ` +
    `${result.prepared} prepared, ${result.autoSubmitted} submitted, ` +
    `${result.stoppedAtReview} pending review`;
}
