/**
 * Fortune 500 / big-tech cover letter standards - length, structure, specificity,
 * ATS-friendly plain text. Used by the generator, UI checklist, and tests.
 *
 * Research basis: Microsoft/Google/Amazon public guidance and recruiter playbooks
 * converge on 250–400 words, 3–4 paragraphs, hook → fit → proof → close, role/company
 * specificity, metrics over adjectives, and no generic "passion" openers.
 */

export const COVER_LETTER_WORD_COUNT_MIN = 250;
export const COVER_LETTER_WORD_COUNT_MAX = 400;
export const COVER_LETTER_PARAGRAPH_MIN = 3;
export const COVER_LETTER_PARAGRAPH_MAX = 4;

/** Openers recruiters flag as instant-delete boilerplate. */
export const GENERIC_OPENERS = [
  "i am writing to apply",
  "i saw your posting",
  "i saw your job posting",
  "to whom it may concern",
  "dear sir or madam",
  "dear sir/madam",
  "i am excited to apply",
  "i was excited to see",
  "please find attached",
  "i would like to express my interest",
] as const;

/** Empty passion/flattery phrases F500 recruiters treat as filler. */
export const PASSION_CLICHES = [
  "passion for",
  "i am passionate",
  "i'm passionate",
  "passionate about",
  "leader in innovation",
  "great team player",
  "perfect fit for your team",
  "dream company",
  "unique opportunity",
] as const;

/** Patterns that break ATS parsing or signal non-plain-text output. */
export const ATS_UNFRIENDLY_PATTERNS = [
  /\*\*[^*]+\*\*/, // markdown bold
  /__[^_]+__/, // markdown underline
  /\t/, // tabs
  /[•●▪◦]/, // bullet glyphs (plain dashes are ok)
  /<[^>]+>/, // HTML tags
] as const;

export type StandardCheckSeverity = "pass" | "warn" | "fail";

export interface StandardCheck {
  id: string;
  label: string;
  passed: boolean;
  severity: StandardCheckSeverity;
  hint?: string;
}

export interface CoverLetterStandardsInput {
  body: string;
  company: string;
  jobTitle: string;
  wordCount?: number;
  openingHook?: string;
  keyJdConcepts?: string[];
  provenanceOk?: boolean;
  /** When true, company/JD specificity checks fail. */
  genericnessFlag?: boolean;
}

export interface CoverLetterStandardsReport {
  /** All checks with severity "fail" are clear. */
  allCriticalPass: boolean;
  checks: StandardCheck[];
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function escapeRegex(s: string): string {
  return s.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentionsCompany(body: string, company: string): boolean {
  const esc = escapeRegex(company);
  return esc.length > 0 && new RegExp(`\\b${esc}\\b`).test(body.toLowerCase());
}

/** True when a meaningful token from the role title appears in the letter. */
export function mentionsRoleTitle(body: string, jobTitle: string): boolean {
  const tokens = jobTitle
    .toLowerCase()
    .split(/[\s,/\-–—]+/)
    .map((t) => t.replace(/[^a-z0-9]/g, ""))
    .filter((t) => t.length > 3);
  if (tokens.length === 0) return false;
  const lower = body.toLowerCase();
  return tokens.some((t) => new RegExp(`\\b${escapeRegex(t)}\\b`).test(lower));
}

export function countParagraphs(body: string): number {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean).length;
}

function hasGenericOpener(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of GENERIC_OPENERS) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

function findPassionCliche(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of PASSION_CLICHES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

function findAtsIssue(body: string): string | null {
  for (const re of ATS_UNFRIENDLY_PATTERNS) {
    if (re.test(body)) return re.source;
  }
  return null;
}

/** F500 structure template echoed in the generation prompt. */
export const F500_STRUCTURE_TEMPLATE = `Paragraph 1 - HOOK: Open with a concrete accomplishment or result from the profile (never "I am writing to apply" or "I saw your posting"). Name the role and company naturally.
Paragraph 2 - FIT: Tie the employer's specific need from the job description to your background. Reference real JD themes; show you read the posting.
Paragraph 3 - PROOF: One short paragraph with 1–2 cited achievements and metrics drawn ONLY from the master profile. Show, don't tell.
Paragraph 4 - CLOSE: Confident call to action (availability, next step). Professional sign-off tone - no empty flattery.`;

/**
 * Validate a cover letter against Fortune 500 / ATS-friendly standards.
 * "fail" = critical miss; "warn" = advisory (length band, clichés, etc.).
 */
export function validateCoverLetterStandards(
  input: CoverLetterStandardsInput,
): CoverLetterStandardsReport {
  const body = input.body.trim();
  const wordCount = input.wordCount ?? countWords(body);
  const checks: StandardCheck[] = [];

  const inWordBand =
    wordCount >= COVER_LETTER_WORD_COUNT_MIN &&
    wordCount <= COVER_LETTER_WORD_COUNT_MAX;
  checks.push({
    id: "word_count",
    label: `${COVER_LETTER_WORD_COUNT_MIN}–${COVER_LETTER_WORD_COUNT_MAX} words`,
    passed: inWordBand,
    severity: inWordBand ? "pass" : "warn",
    hint: inWordBand
      ? undefined
      : `Currently ${wordCount} words - recruiters skim 250–400 word letters.`,
  });

  const paragraphs = countParagraphs(body);
  const paraOk =
    paragraphs >= COVER_LETTER_PARAGRAPH_MIN &&
    paragraphs <= COVER_LETTER_PARAGRAPH_MAX;
  checks.push({
    id: "structure",
    label: `${COVER_LETTER_PARAGRAPH_MIN}–${COVER_LETTER_PARAGRAPH_MAX} paragraphs (hook → fit → proof → close)`,
    passed: paraOk,
    severity: paraOk ? "pass" : "warn",
    hint: paraOk
      ? undefined
      : `Found ${paragraphs} paragraph(s). Use short blocks for skimmability.`,
  });

  const companyOk = mentionsCompany(body, input.company);
  checks.push({
    id: "company_name",
    label: "Names the company",
    passed: companyOk,
    severity: companyOk ? "pass" : "fail",
    hint: companyOk
      ? undefined
      : `Mention "${input.company}" - generic letters get discarded.`,
  });

  const roleOk = mentionsRoleTitle(body, input.jobTitle);
  checks.push({
    id: "role_title",
    label: "References the target role",
    passed: roleOk,
    severity: roleOk ? "pass" : "fail",
    hint: roleOk
      ? undefined
      : `Echo "${input.jobTitle}" or its key terms so ATS and recruiters see a match.`,
  });

  const hookText = (input.openingHook ?? body.split(/\n\s*\n/)[0] ?? "").trim();
  const genericOpener = hasGenericOpener(hookText);
  const hookOk = !genericOpener;
  checks.push({
    id: "strong_hook",
    label: "Strong hook (no boilerplate opener)",
    passed: hookOk,
    severity: hookOk ? "pass" : "fail",
    hint: hookOk
      ? undefined
      : `Avoid "${genericOpener}" - lead with a specific result instead.`,
  });

  const jdConcepts = input.keyJdConcepts ?? [];
  const jdOk = jdConcepts.length >= 1;
  checks.push({
    id: "jd_specificity",
    label: "Mirrors job-description themes",
    passed: jdOk,
    severity: jdOk ? "pass" : "warn",
    hint: jdOk
      ? undefined
      : "Tie at least one real JD concept to a profile fact - not keyword stuffing.",
  });

  const passion = findPassionCliche(body);
  const noPassion = !passion;
  checks.push({
    id: "no_passion_cliches",
    label: "No generic passion/flattery",
    passed: noPassion,
    severity: noPassion ? "pass" : "warn",
    hint: noPassion
      ? undefined
      : `Replace "${passion}" with a concrete metric or example.`,
  });

  const atsIssue = findAtsIssue(body);
  const atsOk = !atsIssue;
  checks.push({
    id: "ats_plain_text",
    label: "ATS-friendly plain text",
    passed: atsOk,
    severity: atsOk ? "pass" : "warn",
    hint: atsOk
      ? undefined
      : "Use plain paragraphs only - no markdown, HTML, or special bullets.",
  });

  if (input.provenanceOk !== undefined) {
    checks.push({
      id: "provenance",
      label: "Facts trace to master profile",
      passed: input.provenanceOk,
      severity: input.provenanceOk ? "pass" : "fail",
      hint: input.provenanceOk
        ? undefined
        : "Every claim and metric must come from your profile - edit or regenerate.",
    });
  }

  if (input.genericnessFlag !== undefined) {
    const specificOk = !input.genericnessFlag;
    checks.push({
      id: "not_generic",
      label: "Role-specific (not could-be-anyone)",
      passed: specificOk,
      severity: specificOk ? "pass" : "warn",
      hint: specificOk
        ? undefined
        : "Add company name and a genuine JD theme so this reads tailored.",
    });
  }

  const allCriticalPass = checks.every(
    (c) => c.passed || c.severity === "warn",
  );

  return { allCriticalPass, checks };
}
