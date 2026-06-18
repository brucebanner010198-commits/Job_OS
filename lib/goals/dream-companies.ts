/**
 * Dream company board - ties CareerGoal direction to explicit target employers.
 * Pure helpers for UI + tests; persistence is in dream-companies-store.ts.
 */
import type { CareerGoalData } from "./types";

export const DREAM_COMPANIES_SOURCE = "dream-companies";

export interface DreamCompany {
  name: string;
  /** 1 = top priority. */
  priority: number;
  domain?: string;
  notes?: string;
  /** User marked brief researched. */
  briefReady?: boolean;
}

/** Industry → well-known employers (suggestions only - user curates the board). */
const INDUSTRY_HINTS: Record<string, string[]> = {
  ai: ["OpenAI", "Anthropic", "Google DeepMind", "NVIDIA"],
  fintech: ["Stripe", "Square", "Plaid", "Robinhood"],
  "big tech": ["Google", "Microsoft", "Amazon", "Apple", "Meta"],
  saas: ["Salesforce", "ServiceNow", "Atlassian", "Snowflake"],
  healthcare: ["UnitedHealth", "CVS Health", "Johnson & Johnson"],
  consulting: ["McKinsey", "BCG", "Bain", "Deloitte"],
};

export function parseDreamCompaniesJson(raw: string): DreamCompany[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is DreamCompany => typeof x === "object" && x !== null && "name" in x)
      .map((x, i) => ({
        name: String(x.name).trim(),
        priority: typeof x.priority === "number" ? x.priority : i + 1,
        domain: x.domain ? String(x.domain) : undefined,
        notes: x.notes ? String(x.notes) : undefined,
        briefReady: Boolean(x.briefReady),
      }))
      .filter((x) => x.name.length > 0)
      .sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

export function serializeDreamCompanies(companies: DreamCompany[]): string {
  return JSON.stringify(companies, null, 2);
}

/** Suggest dream employers from goal industries/titles (heuristic, no web scrape). */
export function suggestDreamCompanies(goal: CareerGoalData, limit = 8): string[] {
  const haystack = [
    ...goal.targetIndustries,
    ...goal.targetTitles,
    goal.northStar,
    goal.summary,
  ]
    .join(" ")
    .toLowerCase();

  const out: string[] = [];
  const seen = new Set<string>();

  for (const [key, names] of Object.entries(INDUSTRY_HINTS)) {
    if (haystack.includes(key) || key.split(" ").some((w) => haystack.includes(w))) {
      for (const n of names) {
        const k = n.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          out.push(n);
        }
      }
    }
  }

  // Titles like "Staff Engineer at Stripe" → extract capitalized tokens
  for (const title of goal.targetTitles) {
    for (const token of title.split(/\s+/)) {
      if (/^[A-Z][a-zA-Z]+$/.test(token) && token.length > 3) {
        const k = token.toLowerCase();
        if (!seen.has(k)) {
          seen.add(k);
          out.push(token);
        }
      }
    }
  }

  return out.slice(0, limit);
}

export function mergeDreamCompanySuggestions(
  existing: DreamCompany[],
  suggestions: string[],
): DreamCompany[] {
  const names = new Set(existing.map((c) => c.name.toLowerCase()));
  const merged = [...existing];
  let nextPriority = existing.length + 1;
  for (const name of suggestions) {
    if (names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());
    merged.push({ name, priority: nextPriority++ });
  }
  return merged.sort((a, b) => a.priority - b.priority);
}
