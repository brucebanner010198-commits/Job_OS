/**
 * HR one-pager - 3-line fit statement for recruiter 6-second skim.
 * Pure, deterministic; no LLM. Built from tailored resume + screening score.
 */
import type { ScreeningScore } from "./screening-score";
import type { TailoredResume } from "./schema";
import { extractMetrics } from "@/lib/util/metrics";

export interface RecruiterSummaryInput {
  resume: TailoredResume;
  screening: ScreeningScore;
  jobTitle?: string;
  company?: string;
}

export interface RecruiterSummary {
  /** Line 1: role fit headline */
  fitLine: string;
  /** Line 2: strongest proof point */
  proofLine: string;
  /** Line 3: keyword/skim signal */
  signalLine: string;
  /** Combined for copy/export */
  threeLines: string;
  /** Binary recruiter decision hint */
  interviewLikelihood: "strong" | "moderate" | "weak";
}

function strongestBullet(resume: TailoredResume): string | null {
  let best: { text: string; score: number } | null = null;
  for (const role of resume.experience) {
    for (const b of role.bullets) {
      const metrics = extractMetrics(b.text);
      const score = metrics.length * 10 + (b.text.length < 120 ? 5 : 0);
      if (!best || score > best.score) best = { text: b.text, score };
    }
  }
  return best?.text ?? null;
}

function topSkills(resume: TailoredResume, limit = 4): string[] {
  const matched = resume.keywordsMatched ?? [];
  if (matched.length > 0) return matched.slice(0, limit);
  return resume.skills
    .flatMap((g) => g.skills)
    .slice(0, limit);
}

/**
 * Generate a scannable 3-line fit statement for HR packet / skim view.
 */
export function generateRecruiterSummary(
  input: RecruiterSummaryInput,
): RecruiterSummary {
  const { resume, screening } = input;
  const title = input.jobTitle ?? resume.forJobTitle;
  const company = input.company ?? resume.forCompany;

  const fitLine = screening.skim.headlineAligned
    ? `${resume.name} - ${resume.headline} (target: ${title}${company ? ` @ ${company}` : ""})`
    : `${resume.name} - ${resume.headline} (align headline to ${title})`;

  const proof = strongestBullet(resume);
  const proofLine = proof
    ? proof.length > 140
      ? `${proof.slice(0, 137)}…`
      : proof
    : "Add quantified bullets to top experience for skim impact.";

  const skills = topSkills(resume);
  const kw = screening.keywordMatchPercent;
  const signalLine =
    skills.length > 0
      ? `ATS ${kw}% · Skim ${screening.skim.score}/100 · Key: ${skills.join(", ")}`
      : `ATS ${kw}% · Skim ${screening.skim.score}/100`;

  const threeLines = [fitLine, proofLine, signalLine].join("\n");

  let interviewLikelihood: RecruiterSummary["interviewLikelihood"] = "weak";
  if (screening.exportRecommended && screening.overall >= 75) {
    interviewLikelihood = "strong";
  } else if (screening.passesAts && screening.passesSkim) {
    interviewLikelihood = "moderate";
  }

  return { fitLine, proofLine, signalLine, threeLines, interviewLikelihood };
}
