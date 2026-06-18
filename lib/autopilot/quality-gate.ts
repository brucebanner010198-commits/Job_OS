/**
 * Quality gate - block low-probability applies before autopilot auto-submit.
 * Volume is capped by score thresholds + daily limits; only AUTONOMOUS routes
 * may pass through to unattended submit (see policy.ts).
 */
import type { ApplyRoute } from "@/lib/apply/types";
import { ATS } from "@/lib/resume/ats-rules";
import { mayAutoSubmit } from "./policy";

export interface QualityGateConfig {
  /** Minimum composite job score (0–1) from lib/scoring/score.ts. */
  minJobScore: number;
  /** Minimum post-tailor screening overall (0–100). */
  minScreeningScore: number;
  /** Lexical keyword floor when tailored screening is unavailable. */
  minKeywordMatchPercent: number;
  /** Max AUTONOMOUS auto-submits per calendar day (ethics cap). */
  maxDailyAutoApplies: number;
}

export function loadQualityGateConfig(): QualityGateConfig {
  return {
    minJobScore: parseFloat(
      process.env.QUALITY_GATE_MIN_JOB_SCORE ?? "0.55",
    ),
    minScreeningScore: parseInt(
      process.env.QUALITY_GATE_MIN_SCREENING ?? "65",
      10,
    ),
    minKeywordMatchPercent: parseInt(
      process.env.QUALITY_GATE_MIN_KEYWORD_MATCH ??
        String(ATS.keywordMatchPassPercent),
      10,
    ),
    maxDailyAutoApplies: parseInt(
      process.env.QUALITY_GATE_MAX_DAILY_AUTO ?? "5",
      10,
    ),
  };
}

export type QualityGateVerdict = "pass" | "block" | "review";

export interface QualityGateInput {
  jobScore: number;
  route: ApplyRoute;
  hardGatePass: boolean;
  /** Post-tailor screening overall when available. */
  screeningScore?: number;
  /** Lexical ATS match on master resume when screening absent. */
  keywordMatchPercent?: number;
  exportRecommended?: boolean;
  /** AUTONOMOUS submits already done today (caller supplies). */
  dailyAutoCount?: number;
}

export interface QualityGateResult {
  verdict: QualityGateVerdict;
  reasons: string[];
  fixes: string[];
  /** True only when verdict is pass AND route is AUTONOMOUS. */
  canAutoSubmit: boolean;
}

/**
 * Evaluate whether an application may proceed to unattended submit.
 * ASSISTED/MANUAL always stop at review regardless of scores.
 */
export function evaluateQualityGate(
  input: QualityGateInput,
  config: QualityGateConfig = loadQualityGateConfig(),
): QualityGateResult {
  const reasons: string[] = [];
  const fixes: string[] = [];

  if (!input.hardGatePass) {
    reasons.push("Hard gate failed - visa, degree, or location mismatch.");
    fixes.push("Update hard facts in profile or skip this role.");
  }

  if (input.jobScore < config.minJobScore) {
    reasons.push(
      `Job score ${Math.round(input.jobScore * 100)}% below ${Math.round(config.minJobScore * 100)}% floor.`,
    );
    fixes.push("Tighten goals filter or wait for better-matched postings.");
  }

  const screening =
    input.screeningScore ??
    (input.keywordMatchPercent !== undefined
      ? input.keywordMatchPercent
      : undefined);

  if (screening !== undefined) {
    const floor = input.screeningScore !== undefined
      ? config.minScreeningScore
      : config.minKeywordMatchPercent;
    if (screening < floor) {
      const label = input.screeningScore !== undefined ? "Screening" : "Keyword match";
      reasons.push(`${label} ${Math.round(screening)}% below ${floor}% floor.`);
      fixes.push("Re-tailor resume or add missing JD keywords to master profile.");
    }
  }

  if (input.exportRecommended === false) {
    reasons.push("Tailored resume failed export gates (ATS/skim/provenance).");
    fixes.push("Fix provenance violations or re-run tailor before applying.");
  }

  if (!mayAutoSubmit(input.route)) {
    reasons.push(`Route ${input.route} requires human review before submit.`);
  }

  const daily = input.dailyAutoCount ?? 0;
  if (daily >= config.maxDailyAutoApplies) {
    reasons.push(
      `Daily auto-apply cap reached (${daily}/${config.maxDailyAutoApplies}).`,
    );
    fixes.push("Resume tomorrow or raise QUALITY_GATE_MAX_DAILY_AUTO with care.");
  }

  let verdict: QualityGateVerdict = "pass";
  if (reasons.some((r) => r.includes("Hard gate") || r.includes("below"))) {
    verdict = "block";
  } else if (reasons.length > 0) {
    verdict = "review";
  }

  const canAutoSubmit =
    verdict === "pass" &&
    mayAutoSubmit(input.route) &&
    daily < config.maxDailyAutoApplies;

  return { verdict, reasons, fixes, canAutoSubmit };
}
