/**
 * Apply readiness - single verdict for job cards and autopilot pre-checks.
 */
import type { ApplyRoute } from "@/lib/apply/types";
import { computeAtsMatch } from "@/lib/scoring/ats-keywords";
import { ATS } from "@/lib/resume/ats-rules";
import {
  evaluateQualityGate,
  loadQualityGateConfig,
} from "@/lib/autopilot/quality-gate";
import type { ScreeningScore } from "@/lib/resume/screening-score";

export type ApplyReadinessStatus = "ready" | "fix_first" | "blocked";

export interface ApplyReadinessInput {
  jobScore: number;
  route: ApplyRoute;
  hardGatePass: boolean;
  jobDescription?: string | null;
  resumeText?: string;
  /** When a tailored resume exists for this target. */
  screening?: ScreeningScore;
}

export interface ApplyReadiness {
  status: ApplyReadinessStatus;
  label: string;
  jobScorePercent: number;
  screeningPercent: number;
  route: ApplyRoute;
  blockers: string[];
  fixes: string[];
}

export function evaluateApplyReadiness(
  input: ApplyReadinessInput,
): ApplyReadiness {
  const jobScorePercent = Math.round(input.jobScore * 100);

  let screeningPercent = 0;
  if (input.screening) {
    screeningPercent = input.screening.overall;
  } else if (input.jobDescription && input.resumeText) {
    screeningPercent = computeAtsMatch(
      input.jobDescription,
      input.resumeText,
    ).matchPercent;
  }

  const keywordMatch =
    input.screening?.keywordMatchPercent ??
    (input.jobDescription && input.resumeText
      ? computeAtsMatch(input.jobDescription, input.resumeText).matchPercent
      : undefined);

  const gate = evaluateQualityGate({
    jobScore: input.jobScore,
    route: input.route,
    hardGatePass: input.hardGatePass,
    screeningScore: input.screening?.overall,
    keywordMatchPercent: keywordMatch,
    exportRecommended: input.screening?.exportRecommended,
  });

  let status: ApplyReadinessStatus = "ready";
  let label = "Ready to apply";

  if (gate.verdict === "block") {
    status = "blocked";
    label = "Blocked";
  } else if (
    gate.verdict === "review" ||
    screeningPercent < loadQualityGateConfig().minScreeningScore ||
    (keywordMatch !== undefined &&
      keywordMatch < ATS.keywordMatchPassPercent &&
      !input.screening)
  ) {
    status = "fix_first";
    label = "Fix first";
  } else if (input.route !== "AUTONOMOUS") {
    status = "fix_first";
    label = input.route === "ASSISTED" ? "Needs review" : "Manual apply";
  }

  return {
    status,
    label,
    jobScorePercent,
    screeningPercent,
    route: input.route,
    blockers: gate.reasons,
    fixes: gate.fixes,
  };
}
