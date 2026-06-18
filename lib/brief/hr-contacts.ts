/**
 * HR contact hints - suggest outreach roles from company brief + careers context.
 * Intelligence + draft guidance only - no LinkedIn scraping or auto-send.
 */
import type { Claim } from "./types";

export type HrContactRole =
  | "recruiter"
  | "hiring_manager"
  | "talent_partner"
  | "hr_generalist";

export interface HrContactHint {
  role: HrContactRole;
  label: string;
  whereToFind: string;
  contactName?: string;
  sourceUrl?: string;
  confidence: "high" | "medium" | "low";
  outreachTip: string;
}

const ROLE_TEMPLATES: Record<
  HrContactRole,
  Omit<HrContactHint, "contactName" | "sourceUrl" | "confidence">
> = {
  recruiter: {
    role: "recruiter",
    label: "Technical / campus recruiter",
    whereToFind: "Company careers page → job posting footer or recruiting inbox",
    outreachTip:
      "Reference the specific req ID; ask who owns hiring for the team - keep it under 120 words.",
  },
  hiring_manager: {
    role: "hiring_manager",
    label: "Hiring manager (role owner)",
    whereToFind: "Brief leadership claims + org chart on careers site; warm-path intro preferred",
    outreachTip:
      "Never cold-spam - use warm-path or recruiter intro. Lead with one metric relevant to their team.",
  },
  talent_partner: {
    role: "talent_partner",
    label: "Talent partner / sourcer",
    whereToFind: "LinkedIn (manual search) or careers events - user initiates contact",
    outreachTip:
      "Share tailored resume link + 2-line fit summary; ask about pipeline timing.",
  },
  hr_generalist: {
    role: "hr_generalist",
    label: "HR / people operations",
    whereToFind: "Careers contact form or jobs@ email on official site",
    outreachTip:
      "Use for process questions only - not pitch decks. Ask about timeline and next steps.",
  },
};

const TITLE_PATTERNS: { re: RegExp; role: HrContactRole }[] = [
  { re: /\bceo\b|\bchief executive\b/i, role: "hiring_manager" },
  { re: /\bcto\b|\bchief technology\b/i, role: "hiring_manager" },
  { re: /\bvp\b|\bvice president\b/i, role: "hiring_manager" },
  { re: /\bdirector\b|\bhead of\b/i, role: "hiring_manager" },
  { re: /\brecruit/i, role: "recruiter" },
  { re: /\btalent\b/i, role: "talent_partner" },
  { re: /\bhr\b|\bhuman resources\b/i, role: "hr_generalist" },
];

function extractNameFromClaim(text: string): string | undefined {
  const appointed = text.match(
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:has been appointed|was appointed|is the|became)/,
  );
  if (appointed?.[1]) return appointed[1];
  const named = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),?\s+(?:CEO|CTO|CFO|COO)/);
  if (named?.[1]) return named[1];
  return undefined;
}

function hintFromClaim(
  claimText: string,
  sourceUrl: string | undefined,
  company: string,
): HrContactHint | null {
  for (const { re, role } of TITLE_PATTERNS) {
    if (!re.test(claimText)) continue;
    const base = ROLE_TEMPLATES[role];
    const contactName = extractNameFromClaim(claimText);
    return {
      ...base,
      label: contactName ? `${base.label} - ${contactName}` : base.label,
      contactName,
      sourceUrl,
      confidence: contactName ? "high" : "medium",
      outreachTip: base.outreachTip.replace("their team", `${company}'s team`),
    };
  }
  return null;
}

/** Minimal brief shape for contact hints (accepts serialized server→client data). */
export type HrContactBriefInput = {
  claims: Array<Pick<Claim, "text" | "category" | "sources">>;
};

export interface HrContactInput {
  company: string;
  brief?: HrContactBriefInput | null;
  careersPageUrl?: string;
}

/**
 * Suggest HR contact roles from brief leadership claims and careers context.
 * Fixture-safe pure function - no network, no LinkedIn API.
 */
export function suggestHrContacts(input: HrContactInput): HrContactHint[] {
  const { company, brief, careersPageUrl } = input;
  const hints: HrContactHint[] = [];
  const seenRoles = new Set<HrContactRole>();

  if (brief) {
    for (const claim of brief.claims) {
      if (claim.category !== "leadership" && claim.category !== "culture") continue;
      const sourceUrl = claim.sources[0]?.url;
      const hint = hintFromClaim(claim.text, sourceUrl, company);
      if (hint && !seenRoles.has(hint.role)) {
        seenRoles.add(hint.role);
        hints.push(hint);
      }
    }
  }

  // Always surface recruiter + talent partner as baseline outreach paths
  for (const role of ["recruiter", "talent_partner"] as HrContactRole[]) {
    if (seenRoles.has(role)) continue;
    seenRoles.add(role);
    const base = ROLE_TEMPLATES[role];
    hints.push({
      ...base,
      confidence: "medium",
      sourceUrl: careersPageUrl,
      whereToFind: careersPageUrl
        ? `${base.whereToFind} (${careersPageUrl})`
        : base.whereToFind,
    });
  }

  if (!seenRoles.has("hiring_manager")) {
    hints.push({
      ...ROLE_TEMPLATES.hiring_manager,
      confidence: "low",
      sourceUrl: careersPageUrl,
      outreachTip:
        "Prefer warm-path intro to the hiring manager - cold outreach to executives rarely converts.",
    });
  }

  return hints;
}
