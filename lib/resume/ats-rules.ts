/**
 * ATS + human skim rules (research-grounded).
 *
 * Sources:
 * - Haired 10k-CV ATS study (2025): formatting/tables/keyword gaps
 * - Indeed, RecruitBPM, LockedIn: ATS parsing failures
 * - TheLadders eye-tracking (2012, replicated 2018): 6–7s initial skim
 * - Careerflow, JobLabs, Curriculo: recruiter scan order & metrics
 * - Google/Amazon public career guidance: clarity, quantified impact, no gimmicks
 */

/** Layout, typography, and export constraints shared by renderer + validator. */
export const ATS = {
  /** Text-selectable PDF, single column, standard headers - never tables/graphics. */
  minFontPt: 10,
  bodyFontPt: 10.5,
  headingFontPt: 13,
  nameFontPt: 20,
  /** Safe, widely-installed fonts only. */
  fontStack:
    "Georgia, 'Times New Roman', Calibri, Arial, Helvetica, sans-serif",
  /** Standard section headers ATS reliably recognizes. */
  sectionHeaders: {
    summary: "Summary",
    experience: "Experience",
    education: "Education",
    skills: "Skills",
  },
  /** Length is rule-driven, not "always one page" (truncating seniors is worse). */
  pageTargetBySeniority: {
    student: 1,
    junior: 1,
    mid: 1,
    senior: 2,
    executive: 2,
  },
  maxBulletsPerRole: 6,
  /** Over-optimization reads as stuffing and can flag fraud. Cap concept reuse. */
  maxKeywordRepeat: 3,
  /** Lexical keyword match below this often fails Workday/Taleo/Greenhouse filters. */
  keywordMatchPassPercent: 70,
  /** Ideal range per tailored resume (Jobscan/cvtailor parity). */
  keywordMatchIdealPercent: 80,
  /** Bullets with metrics recruiters hunt for in the first pass. */
  topFoldMetricBullets: 4,
  /** Max words per bullet before "wall of text" skim penalty. */
  maxWordsPerBullet: 35,
  /** Approximate one-page word budget (letter, 0.5in margins, 10.5pt). */
  onePageWordBudget: 450,
  /** Two-page senior budget. */
  twoPageWordBudget: 900,
} as const;

export type AtsRuleSeverity = "block" | "warn";

export interface AtsRule {
  id: string;
  category: "format" | "keywords" | "structure" | "dates" | "file" | "human-skim";
  severity: AtsRuleSeverity;
  /** Short label for UI / reports. */
  title: string;
  /** Actionable guidance for the tailor prompt or validator. */
  guidance: string;
}

/**
 * Documented ATS + recruiter rules. The tailor system prompt and screening
 * scorer both reference these ids for consistent messaging.
 */
export const ATS_RULES: readonly AtsRule[] = [
  // -- Format (parser failures) ---------------------------------------------
  {
    id: "fmt-single-column",
    category: "format",
    severity: "block",
    title: "Single-column layout",
    guidance:
      "Use one column only. Multi-column layouts scramble parse order (44–52% failure in studies).",
  },
  {
    id: "fmt-no-tables",
    category: "format",
    severity: "block",
    title: "No tables or text boxes",
    guidance:
      "Never use tables, text boxes, or skill-rating graphics - ATS may skip or merge cells.",
  },
  {
    id: "fmt-no-graphics",
    category: "format",
    severity: "block",
    title: "No images or icons",
    guidance:
      "No logos, headshots, icons, or decorative dividers - parsers are text-only.",
  },
  {
    id: "fmt-standard-headers",
    category: "format",
    severity: "warn",
    title: "Standard section headers",
    guidance:
      'Use "Summary", "Experience", "Education", "Skills" - creative headings break field mapping.',
  },
  {
    id: "fmt-safe-fonts",
    category: "format",
    severity: "warn",
    title: "Standard fonts",
    guidance:
      "Stick to Arial, Calibri, Georgia, Times New Roman, or Verdana at 10–12pt body.",
  },
  {
    id: "fmt-contact-in-body",
    category: "format",
    severity: "warn",
    title: "Contact in document body",
    guidance:
      "Place email/phone in the main body, not Word/PDF headers or footers (31% parse failures).",
  },
  // -- Keywords -------------------------------------------------------------
  {
    id: "kw-mirror-jd",
    category: "keywords",
    severity: "block",
    title: "Mirror JD terminology",
    guidance:
      "Weave 15–20 top JD terms naturally into summary, skills, and experience - not a keyword footer.",
  },
  {
    id: "kw-acronym-pair",
    category: "keywords",
    severity: "warn",
    title: "Acronym + full term",
    guidance:
      'First use both forms: "Search Engine Optimization (SEO)" so parsers match either variant.',
  },
  {
    id: "kw-no-stuffing",
    category: "keywords",
    severity: "block",
    title: "No keyword stuffing",
    guidance: `Repeat no term more than ${ATS.maxKeywordRepeat} times; dense keyword blocks trigger fraud flags.`,
  },
  {
    id: "kw-tailor-per-role",
    category: "keywords",
    severity: "warn",
    title: "Tailor per application",
    guidance:
      "Generic resumes score <40% keyword match; tailored resumes reach 70%+ and pass filters 6× more often.",
  },
  // -- Structure & dates ----------------------------------------------------
  {
    id: "struct-mm-yyyy",
    category: "dates",
    severity: "block",
    title: "MM/YYYY dates",
    guidance: 'Use MM/YYYY or "Present" consistently - recruiters triangulate tenure in the first 6s.',
  },
  {
    id: "struct-recent-first",
    category: "structure",
    severity: "warn",
    title: "Reverse-chronological experience",
    guidance: "Most recent role first; title, company, and dates must be scannable on one line.",
  },
  {
    id: "struct-bullet-cap",
    category: "structure",
    severity: "warn",
    title: "Bullet density",
    guidance: `At most ${ATS.maxBulletsPerRole} bullets per role; lead with highest-impact, job-relevant wins.`,
  },
  // -- File type (export path) ----------------------------------------------
  {
    id: "file-docx-or-pdf",
    category: "file",
    severity: "warn",
    title: "Text-based .docx or PDF",
    guidance:
      "Prefer .docx; use text-layer PDF only when required. Image-only PDFs parse as blank.",
  },
  // -- Human 6-second skim (TheLadders / JobLabs) ---------------------------
  {
    id: "skim-headline-match",
    category: "human-skim",
    severity: "block",
    title: "Headline matches target role",
    guidance:
      "Headline under name = target job title (not only current employer title). 80% of skim time hits title/company/dates/education.",
  },
  {
    id: "skim-metrics-top-fold",
    category: "human-skim",
    severity: "block",
    title: "Metrics in top bullets",
    guidance: `First ${ATS.topFoldMetricBullets} bullets of the most recent role must include digits (%, $, #, x) when sources allow.`,
  },
  {
    id: "skim-no-wall",
    category: "human-skim",
    severity: "warn",
    title: "Scannable bullets",
    guidance: `Keep bullets under ~${ATS.maxWordsPerBullet} words; recruiters scan digits, not paragraphs.`,
  },
  {
    id: "skim-seniority-signal",
    category: "human-skim",
    severity: "warn",
    title: "Seniority signal",
    guidance:
      "Title progression and scope (team size, budget, users) must align with the target level - mismatches trigger instant drops.",
  },
  {
    id: "skim-one-page-density",
    category: "human-skim",
    severity: "warn",
    title: "Page density",
    guidance:
      "Junior/mid: fit core story on one page. Seniors: two pages max; page-one top third is premium real estate.",
  },
] as const;

/** Rules injected into the tailor LLM system prompt (human-skim + keywords). */
export function screeningPromptBlock(
  seniority: keyof typeof ATS.pageTargetBySeniority,
  jobTitle: string,
): string {
  const pages = ATS.pageTargetBySeniority[seniority];
  const wordBudget =
    pages === 1 ? ATS.onePageWordBudget : ATS.twoPageWordBudget;

  return `6-SECOND RECRUITER SKIM (structure - TheLadders eye-tracking, Fortune 500 norms):
Recruiters spend ~6–7 seconds on the first pass. They scan (in order): name → headline → current company → dates → previous role → education → digits in bullets.

Mandatory layout for this resume:
1. HEADLINE: Set headline to the TARGET role ("${jobTitle}"), not a vague label like "Professional" or only your current title.
2. TOP-OF-FOLD METRICS: In the most recent role, put 3–4 bullets FIRST that include verbatim metrics from sources (%, $, counts, multipliers). If no metric exists in sources for a bullet, use a strong CAR/PAR bullet instead - never invent numbers.
3. SCANNABLE DENSITY: ≤${ATS.maxBulletsPerRole} bullets/role; ≤${ATS.maxWordsPerBullet} words/bullet; ~${wordBudget} words total for ${pages} page(s).
4. KEYWORD FIT: Mirror JD terminology where honestly supported; include acronym+full-term on first use; never repeat any term >${ATS.maxKeywordRepeat}×.
5. DATES & TITLES: MM/YYYY or Present; reverse-chronological; title + company + date range visible without scrolling on page 1.
6. NO WALL OF TEXT: Short clauses, action verbs, one achievement per bullet - recruiters hunt digits, not prose blocks.

ATS FORMAT (our renderer enforces this - do not fight it in JSON content):
- Standard sections only; no tables/columns/graphics language.
- Plain ASCII punctuation; no emoji or decorative bullets.`;
}

/** Rule lookup by id (for screening reports). */
export function getAtsRule(id: string): AtsRule | undefined {
  return ATS_RULES.find((r) => r.id === id);
}

/**
 * Replace characters that garble ATS parsers (smart quotes, em/en dashes,
 * decorative bullets, non-breaking spaces, emoji) with ASCII-safe equivalents.
 */
export function sanitizeForAts(input: string): string {
  return input
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[“”„‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[•●▪◦⁃∙]/g, "-")
    .replace(/ /g, " ")
    // strip emoji / pictographs
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** True if a date string is MM/YYYY or "Present". */
export function isAtsDate(s: string): boolean {
  return /^(0[1-9]|1[0-2])\/\d{4}$/.test(s) || s === "Present";
}

/** True if text contains a quantified signal recruiters scan for (digits, %, $). */
export function hasMetricSignal(text: string): boolean {
  return /(?:\d[\d,.]*\s*%|\$[\d,.]+[kmb]?|\d[\d,.]*\s*(?:x|k|m|b)\b|\b\d{2,}\b)/i.test(
    text,
  );
}

/** Count words in a string (for density checks). */
export function wordCount(text: string): number {
  const t = text.trim();
  if (t.length === 0) return 0;
  return t.split(/\s+/).length;
}

/** Detect likely keyword stuffing: any token repeated over the cap. */
export function findKeywordStuffing(
  text: string,
  maxRepeat = ATS.maxKeywordRepeat,
): string[] {
  const tokens = text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length >= 4);
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .filter(([, n]) => n > maxRepeat)
    .map(([t]) => t)
    .sort();
}
