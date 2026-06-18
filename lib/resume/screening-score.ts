/**
 * Post-tailor screening score - keyword match, 6-second skim clarity, red flags.
 * Pure, deterministic, no LLM. Complements provenance (truth) with pass likelihood.
 */
import { computeAtsMatch } from "@/lib/scoring/ats-keywords";
import {
  ATS,
  findKeywordStuffing,
  hasMetricSignal,
  isAtsDate,
  wordCount,
  type AtsRuleSeverity,
} from "./ats-rules";
import { renderResumePlainText } from "./render";
import type { TailoredResume } from "./schema";

export interface ScreeningFlag {
  ruleId: string;
  severity: AtsRuleSeverity;
  message: string;
}

export interface SkimClarityBreakdown {
  /** 0–100 partial score for recruiter first-pass readability. */
  score: number;
  headlineAligned: boolean;
  metricsInTopFold: number;
  metricsInTopFoldRequired: number;
  datedRoles: number;
  totalRoles: number;
  avgWordsPerBullet: number;
  totalWords: number;
  wordBudget: number;
}

export interface ScreeningScore {
  /** 0–100 composite (keyword 40%, skim 40%, red-flag penalty 20%). */
  overall: number;
  keywordMatchPercent: number;
  keywordGaps: string[];
  skim: SkimClarityBreakdown;
  redFlags: ScreeningFlag[];
  /** No block-severity red flags and keyword ≥ pass threshold. */
  passesAts: boolean;
  /** Skim score ≥ 60 and headline aligned. */
  passesSkim: boolean;
  /** Both gates pass. */
  exportRecommended: boolean;
}

export interface ScreeningScoreInput {
  resume: TailoredResume;
  jobDescription: string;
  seniority?: keyof typeof ATS.pageTargetBySeniority;
}

function tokenOverlap(a: string, b: string): number {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  const ta = new Set(norm(a));
  const tb = new Set(norm(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.max(ta.size, tb.size);
}

function checkHeadlineAligned(resume: TailoredResume): boolean {
  const target = resume.forJobTitle.trim().toLowerCase();
  const headline = resume.headline.trim().toLowerCase();
  if (target.length === 0 || headline.length === 0) return false;
  if (headline === target) return true;
  if (headline.includes(target) || target.includes(headline)) return true;
  return tokenOverlap(headline, target) >= 0.5;
}

function collectRedFlags(
  resume: TailoredResume,
  plainText: string,
  seniority: keyof typeof ATS.pageTargetBySeniority,
): ScreeningFlag[] {
  const flags: ScreeningFlag[] = [];

  if (!checkHeadlineAligned(resume)) {
    flags.push({
      ruleId: "skim-headline-match",
      severity: "block",
      message: `Headline "${resume.headline}" does not align with target role "${resume.forJobTitle}".`,
    });
  }

  for (const stuffed of findKeywordStuffing(plainText)) {
    flags.push({
      ruleId: "kw-no-stuffing",
      severity: "block",
      message: `Term "${stuffed}" appears more than ${ATS.maxKeywordRepeat} times - keyword stuffing risk.`,
    });
  }

  for (let i = 0; i < resume.experience.length; i++) {
    const role = resume.experience[i]!;
    if (!isAtsDate(role.start) || !isAtsDate(role.end)) {
      flags.push({
        ruleId: "struct-mm-yyyy",
        severity: "block",
        message: `experience[${i}] dates must be MM/YYYY or Present (got ${role.start}–${role.end}).`,
      });
    }
    for (let j = 0; j < role.bullets.length; j++) {
      const words = wordCount(role.bullets[j]!.text);
      if (words > ATS.maxWordsPerBullet) {
        flags.push({
          ruleId: "skim-no-wall",
          severity: "warn",
          message: `experience[${i}].bullets[${j}] is ${words} words (>${ATS.maxWordsPerBullet}) - wall-of-text skim risk.`,
        });
      }
    }
    if (role.bullets.length > ATS.maxBulletsPerRole) {
      flags.push({
        ruleId: "struct-bullet-cap",
        severity: "warn",
        message: `experience[${i}] has ${role.bullets.length} bullets (max ${ATS.maxBulletsPerRole}).`,
      });
    }
  }

  const pages = ATS.pageTargetBySeniority[seniority];
  const budget =
    pages === 1 ? ATS.onePageWordBudget : ATS.twoPageWordBudget;
  const totalWords = wordCount(plainText);
  if (totalWords > budget * 1.15) {
    flags.push({
      ruleId: "skim-one-page-density",
      severity: "warn",
      message: `Resume is ~${totalWords} words (budget ~${budget} for ${pages} page(s)) - may truncate on skim.`,
    });
  }

  if (resume.experience.length === 0) {
    flags.push({
      ruleId: "struct-recent-first",
      severity: "block",
      message: "No experience section - fails recruiter shape check.",
    });
  }

  return flags;
}

function scoreSkimClarity(
  resume: TailoredResume,
  plainText: string,
  seniority: keyof typeof ATS.pageTargetBySeniority,
): SkimClarityBreakdown {
  const headlineAligned = checkHeadlineAligned(resume);
  const required = ATS.topFoldMetricBullets;

  const recent = resume.experience[0];
  const topBullets = recent?.bullets.slice(0, required) ?? [];
  const metricsInTopFold = topBullets.filter((b) =>
    hasMetricSignal(b.text),
  ).length;

  let datedRoles = 0;
  for (const role of resume.experience) {
    if (isAtsDate(role.start) && isAtsDate(role.end)) datedRoles++;
  }

  let bulletWords = 0;
  let bulletCount = 0;
  for (const role of resume.experience) {
    for (const b of role.bullets) {
      bulletWords += wordCount(b.text);
      bulletCount++;
    }
  }

  const totalWords = wordCount(plainText);
  const pages = ATS.pageTargetBySeniority[seniority];
  const wordBudget =
    pages === 1 ? ATS.onePageWordBudget : ATS.twoPageWordBudget;

  let score = 0;
  if (headlineAligned) score += 25;
  score += Math.min(35, (metricsInTopFold / required) * 35);
  if (resume.experience.length > 0) {
    score += (datedRoles / resume.experience.length) * 20;
  }
  const avgWords = bulletCount > 0 ? bulletWords / bulletCount : 0;
  if (avgWords <= ATS.maxWordsPerBullet) score += 10;
  if (totalWords <= wordBudget) score += 10;
  else if (totalWords <= wordBudget * 1.1) score += 5;

  return {
    score: Math.round(Math.min(100, score)),
    headlineAligned,
    metricsInTopFold,
    metricsInTopFoldRequired: required,
    datedRoles,
    totalRoles: resume.experience.length,
    avgWordsPerBullet: Math.round(avgWords * 10) / 10,
    totalWords,
    wordBudget,
  };
}

/**
 * Score a tailored resume against JD keyword overlap and recruiter skim heuristics.
 */
export function scoreScreening(input: ScreeningScoreInput): ScreeningScore {
  const seniority = input.seniority ?? "mid";
  const plainText = renderResumePlainText(input.resume);
  const ats = computeAtsMatch(input.jobDescription, plainText);
  const redFlags = collectRedFlags(input.resume, plainText, seniority);
  const skim = scoreSkimClarity(input.resume, plainText, seniority);

  const blockCount = redFlags.filter((f) => f.severity === "block").length;
  const warnCount = redFlags.filter((f) => f.severity === "warn").length;
  const redFlagPenalty = Math.min(
    20,
    blockCount * 10 + warnCount * 2,
  );

  const keywordComponent = ats.matchPercent * 0.4;
  const skimComponent = skim.score * 0.4;
  const overall = Math.round(
    Math.max(
      0,
      Math.min(100, keywordComponent + skimComponent + (20 - redFlagPenalty)),
    ),
  );

  const passesAts =
    ats.matchPercent >= ATS.keywordMatchPassPercent &&
    blockCount === 0;
  const passesSkim = skim.score >= 60 && skim.headlineAligned;

  return {
    overall,
    keywordMatchPercent: ats.matchPercent,
    keywordGaps: ats.gaps,
    skim,
    redFlags,
    passesAts,
    passesSkim,
    exportRecommended: passesAts && passesSkim,
  };
}
