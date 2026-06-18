/**
 * Volatile-fact classification and staleness checks (Phase 4 - Company Brief).
 *
 * "Volatile" means the fact changes frequently enough that a single source
 * and/or an old retrieval date cannot be trusted alone. Three categories are
 * volatile (VOLATILE_CATEGORIES from types): funding, headcount, leadership.
 *
 * No LLM, no network, no Math.random - pure deterministic heuristics.
 */

import { type FactCategory, VOLATILE_CATEGORIES, FRESHNESS_DAYS } from "@/lib/brief/types";

// ---------------------------------------------------------------------------
// Keyword tables for classifyFact
// ---------------------------------------------------------------------------

/** Patterns indicating funding activity. */
const FUNDING_PATTERNS: RegExp[] = [
  /\braised\b/i,
  /\bseries\s+[abcdefgh]\b/i,
  /\bseed\s+round\b/i,
  /\$[\d,.]+\s*(m|million|b|billion|k|thousand)/i,
  /\bvaluation\b/i,
  /\bfunding\s+round\b/i,
  /\binvest(?:ed|ment|or)\b/i,
  /\bvc\b/i,
  /\bventure\s+capital\b/i,
  /\bpre-?ipo\b/i,
];

/** Patterns indicating headcount / team size. */
const HEADCOUNT_PATTERNS: RegExp[] = [
  /\bemployees\b/i,
  /\bteam\s+of\s+\d/i,
  /\bheadcount\b/i,
  /\bstaff\s+of\s+\d/i,
  /\b\d[\d,]*\s+people\b/i,
  /\bworkforce\b/i,
  /\bhires\b/i,
  /\blaid\s+off\b/i,
  /\blayoff\b/i,
];

/** Patterns indicating leadership changes or named officers. */
const LEADERSHIP_PATTERNS: RegExp[] = [
  /\bceo\b/i,
  /\bcto\b/i,
  /\bcoo\b/i,
  /\bcfo\b/i,
  /\bchief\s+\w+\s+officer\b/i,
  /\bfounder\b/i,
  /\bco-founder\b/i,
  /\bappointed\b/i,
  /\bhired\s+as\b/i,
  /\bsteps\s+down\b/i,
  /\bresigned\b/i,
  /\bpresident\b/i,
];

/** Patterns indicating product information. */
const PRODUCT_PATTERNS: RegExp[] = [
  /\bplatform\b/i,
  /\bproduct\b/i,
  /\bfeature\b/i,
  /\blaunch(?:ed|es)?\b/i,
  /\bapi\b/i,
  /\bsoftware\b/i,
  /\bapp\b/i,
  /\bservice\b/i,
  /\bintegration\b/i,
];

/** Patterns indicating news/events. */
const NEWS_PATTERNS: RegExp[] = [
  /\bannounced\b/i,
  /\bpartnershi?p\b/i,
  /\bacquir(?:ed|ition)\b/i,
  /\bmerger\b/i,
  /\bexpands?\b/i,
];

// ---------------------------------------------------------------------------

/**
 * Classify a fact string into a FactCategory using keyword heuristics.
 * Order matters: more specific (volatile) categories are checked first so
 * that e.g. "raised $50M Series B" lands in "funding", not "news".
 */
export function classifyFact(text: string): FactCategory {
  if (FUNDING_PATTERNS.some((p) => p.test(text))) return "funding";
  if (HEADCOUNT_PATTERNS.some((p) => p.test(text))) return "headcount";
  if (LEADERSHIP_PATTERNS.some((p) => p.test(text))) return "leadership";
  if (PRODUCT_PATTERNS.some((p) => p.test(text))) return "product";
  if (NEWS_PATTERNS.some((p) => p.test(text))) return "news";

  // Fall through to overview if the text is long-ish and descriptive, else "other".
  if (text.length > 60) return "overview";
  return "other";
}

/**
 * True when the category is in the volatile set (funding/headcount/leadership).
 * Uses the canonical VOLATILE_CATEGORIES constant so the rule lives in one place.
 */
export function isVolatile(category: FactCategory): boolean {
  return VOLATILE_CATEGORIES.has(category);
}

/**
 * True when a retrieval timestamp is older than FRESHNESS_DAYS relative to now.
 * Uses only the supplied dates - no Date.now() - keeping composeBrief pure.
 */
export function isStale(retrievedAt: Date, now: Date): boolean {
  const msPerDay = 24 * 60 * 60 * 1000;
  const ageDays = (now.getTime() - retrievedAt.getTime()) / msPerDay;
  return ageDays > FRESHNESS_DAYS;
}
