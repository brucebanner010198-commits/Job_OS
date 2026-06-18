/**
 * Gap analysis - compare profile vs JD + brief requirements → prioritized fixes.
 * Pure (no LLM); powers training hub and coach notes.
 */
import { computeAtsMatch, extractJdKeywords } from "@/lib/scoring/ats-keywords";
import { ATS } from "@/lib/resume/ats-rules";
import type { CompanyBriefData } from "@/lib/brief/types";

export type GapCategory =
  | "skill"
  | "experience"
  | "domain"
  | "format"
  | "leadership"
  | "culture";

export type GapPriority = "critical" | "high" | "medium" | "low";

export interface GapItem {
  id: string;
  category: GapCategory;
  priority: GapPriority;
  gap: string;
  fix: string;
  evidence?: string;
}

export interface GapAnalysisInput {
  profileText: string;
  jobDescription: string;
  brief?: CompanyBriefData | null;
  goalText?: string;
  company?: string;
  roleTitle?: string;
}

export interface GapAnalysisResult {
  matchPercent: number;
  gaps: GapItem[];
  summary: string;
}

function priorityFromMatchPercent(pct: number): GapPriority {
  if (pct < 40) return "critical";
  if (pct < ATS.keywordMatchPassPercent) return "high";
  if (pct < ATS.keywordMatchIdealPercent) return "medium";
  return "low";
}

function briefRequirementGaps(brief: CompanyBriefData | null | undefined): GapItem[] {
  if (!brief) return [];
  const gaps: GapItem[] = [];
  const leadership = brief.claims.filter((c) => c.category === "leadership");
  if (leadership.length > 0) {
    gaps.push({
      id: "brief-leadership",
      category: "leadership",
      priority: "medium",
      gap: "Understand who leads the org you're applying to",
      fix: `Research leadership context before outreach - ${leadership[0]!.text.slice(0, 120)}…`,
      evidence: leadership[0]!.text,
    });
  }
  const culture = brief.claims.filter((c) => c.category === "culture");
  if (culture.length > 0) {
    gaps.push({
      id: "brief-culture",
      category: "culture",
      priority: "low",
      gap: "Culture signals not mirrored in materials",
      fix: "Echo one verified culture theme in cover letter proof paragraph",
      evidence: culture[0]!.text,
    });
  }
  return gaps;
}

function goalAlignmentGap(
  profileText: string,
  goalText: string | undefined,
  jd: string,
): GapItem | null {
  if (!goalText?.trim()) return null;
  const goalTokens = goalText.toLowerCase().split(/\W+/).filter((t) => t.length > 4);
  const jdLower = jd.toLowerCase();
  const aligned = goalTokens.some((t) => jdLower.includes(t));
  if (aligned) return null;
  return {
    id: "goal-misalign",
    category: "domain",
    priority: "medium",
    gap: "Role may not align with stated career north-star",
    fix: "Confirm this role advances your goals - or tighten discovery filters",
    evidence: "Goal keywords absent from JD",
  };
}

/** Compare profile vs JD + optional brief; return prioritized gap list. */
export function analyzeGaps(input: GapAnalysisInput): GapAnalysisResult {
  const { profileText, jobDescription, brief, goalText } = input;
  const ats = computeAtsMatch(jobDescription, profileText);
  const basePriority = priorityFromMatchPercent(ats.matchPercent);
  const gaps: GapItem[] = [];

  for (const kw of ats.gaps.slice(0, 8)) {
    gaps.push({
      id: `kw-${kw}`,
      category: "skill",
      priority: basePriority,
      gap: `JD keyword missing from profile: "${kw}"`,
      fix: `Add truthful evidence for "${kw}" in master resume or tailor bullet`,
    });
  }

  if (ats.matchPercent < ATS.keywordMatchPassPercent) {
    gaps.push({
      id: "ats-band",
      category: "format",
      priority: "high",
      gap: `ATS keyword match ${ats.matchPercent}% - below ${ATS.keywordMatchPassPercent}% pass band`,
      fix: "Re-tailor resume mirroring JD language without stuffing",
    });
  }

  const expSignals = ["senior", "staff", "principal", "lead", "manager", "director"];
  const jdSenior = expSignals.filter((s) => jobDescription.toLowerCase().includes(s));
  const profileSenior = expSignals.filter((s) => profileText.toLowerCase().includes(s));
  if (jdSenior.length > 0 && profileSenior.length === 0) {
    gaps.push({
      id: "seniority",
      category: "experience",
      priority: "high",
      gap: `JD signals ${jdSenior.join("/")} level - profile headline may under-state seniority`,
      fix: "Align headline and top bullet with target seniority band",
    });
  }

  const goalGap = goalAlignmentGap(profileText, goalText, jobDescription);
  if (goalGap) gaps.push(goalGap);

  gaps.push(...briefRequirementGaps(brief));

  const keywords = extractJdKeywords(jobDescription);
  if (keywords.length > 5 && ats.matched.length < 3) {
    gaps.push({
      id: "thin-overlap",
      category: "skill",
      priority: "critical",
      gap: "Very low lexical overlap with a keyword-rich JD",
      fix: "Run gap analysis before apply - consider skipping or warm-path first",
    });
  }

  const priorityOrder: Record<GapPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  gaps.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  const summary =
    gaps.length === 0
      ? `Strong match (${ats.matchPercent}% ATS keywords) - proceed to tailor and apply.`
      : `${gaps.length} gap(s) at ${ats.matchPercent}% match - address critical items before applying.`;

  return { matchPercent: ats.matchPercent, gaps, summary };
}

export function formatGapAnalysisBody(
  result: GapAnalysisResult,
  context: { company?: string; roleTitle?: string },
): string {
  const header = [
    context.company && context.roleTitle
      ? `Target: ${context.roleTitle} @ ${context.company}`
      : null,
    `Match: ${result.matchPercent}%`,
    result.summary,
    "",
    "## Gaps (prioritized)",
  ]
    .filter(Boolean)
    .join("\n");

  const lines = result.gaps.map(
    (g) =>
      `- [${g.priority}] **${g.category}**: ${g.gap}\n  → Fix: ${g.fix}${g.evidence ? `\n  Evidence: ${g.evidence}` : ""}`,
  );

  return [header, ...lines].join("\n");
}
