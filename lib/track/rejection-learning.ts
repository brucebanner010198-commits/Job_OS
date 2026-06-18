/**
 * Rejection learning - parse Gmail rejection signals into improvement notes.
 * Advisory only; never auto-changes profile or re-submits (human approves).
 */
import {
  failureModesForSignals,
  suggestProfileFixes,
} from "@/lib/candidate/failure-modes";

export interface RejectionSuggestion {
  kind: "resume" | "cover_letter" | "apply_answer" | "targeting";
  text: string;
  confidence: "high" | "medium";
  provenance: "email_quote" | "inferred";
}

export interface RejectionIntel {
  applicationId: string;
  company: string;
  role: string;
  category: "SOFT_REJECTION" | "REJECTION";
  signals: string[];
  inferredReasons: string[];
  suggestions: RejectionSuggestion[];
  createdAt: string;
}

/** Industry-standard rejection buckets for transparency loop. */
export type RejectionCategory =
  | "fit"
  | "experience"
  | "timing"
  | "formatting"
  | "unknown";

export interface RejectionFix {
  text: string;
  module: "resume" | "cover_letter" | "apply" | "goals" | "warm-path" | "training";
}

export interface RejectionExplanation {
  primaryCategory: RejectionCategory;
  categories: RejectionCategory[];
  summary: string;
  signals: string[];
  fixes: RejectionFix[];
  confidence: "high" | "medium" | "low";
}

const SIGNAL_PATTERNS: { phrase: string; kind: RejectionSuggestion["kind"]; suggestion: string }[] = [
  {
    phrase: "other candidates",
    kind: "targeting",
    suggestion: "Role may be highly competitive - tighten seniority/scope filters in goals.",
  },
  {
    phrase: "moving forward with",
    kind: "targeting",
    suggestion: "Standard pass - note company/role for warm-path follow-up in 6–12 months.",
  },
  {
    phrase: "experience",
    kind: "resume",
    suggestion: "JD may emphasize experience you under-stated - add quantified bullets to master resume.",
  },
  {
    phrase: "skills",
    kind: "resume",
    suggestion: "Skill gap suspected - compare ATS keyword gaps before next tailor.",
  },
  {
    phrase: "sponsorship",
    kind: "apply_answer",
    suggestion: "Visa/sponsorship may have been a factor - verify apply answers match truthfully.",
  },
  {
    phrase: "salary",
    kind: "apply_answer",
    suggestion: "Compensation mismatch possible - align salary expectation with role band.",
  },
  {
    phrase: "location",
    kind: "targeting",
    suggestion: "Location or remote policy may not align - filter remote/hybrid preferences earlier.",
  },
];

function haystack(subject: string, snippet?: string | null, rationale?: string): string {
  return [subject, snippet ?? "", rationale ?? ""].join(" ").toLowerCase();
}

/**
 * Pure parser - grounded in email text only, no LLM fabrication.
 */
export function parseRejectionLearning(input: {
  applicationId: string;
  company: string;
  role: string;
  category: "SOFT_REJECTION" | "REJECTION";
  subject: string;
  snippet?: string | null;
  rationale?: string;
  now?: Date;
}): RejectionIntel {
  const text = haystack(input.subject, input.snippet, input.rationale);
  const signals: string[] = [];
  const suggestions: RejectionSuggestion[] = [];
  const seen = new Set<string>();

  for (const { phrase, kind, suggestion } of SIGNAL_PATTERNS) {
    if (text.includes(phrase)) {
      signals.push(phrase);
      if (!seen.has(suggestion)) {
        seen.add(suggestion);
        suggestions.push({
          kind,
          text: suggestion,
          confidence: "high",
          provenance: "email_quote",
        });
      }
    }
  }

  const inferredReasons: string[] = [];
  if (input.category === "SOFT_REJECTION") {
    inferredReasons.push("Soft rejection - pipeline closed but relationship may stay open.");
  }
  if (signals.length === 0) {
    inferredReasons.push("No specific reason parsed - generic pass email.");
    suggestions.push({
      kind: "targeting",
      text: "Log this outcome and review score + ATS gaps for similar roles.",
      confidence: "medium",
      provenance: "inferred",
    });
  }

  return {
    applicationId: input.applicationId,
    company: input.company,
    role: input.role,
    category: input.category,
    signals,
    inferredReasons,
    suggestions,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}

const CATEGORY_SIGNALS: { category: RejectionCategory; phrases: string[] }[] = [
  {
    category: "fit",
    phrases: [
      "other candidates",
      "moving forward with",
      "not moving forward",
      "decided to pursue",
      "more closely match",
      "better suited",
    ],
  },
  {
    category: "experience",
    phrases: ["experience", "years of", "background", "qualifications", "skills"],
  },
  {
    category: "timing",
    phrases: [
      "position has been filled",
      "role has been filled",
      "hiring freeze",
      "on hold",
      "paused",
      "keep your resume on file",
      "future opportunities",
    ],
  },
  {
    category: "formatting",
    phrases: [
      "incomplete application",
      "missing information",
      "could not open",
      "unable to review",
      "format",
    ],
  },
];

const CATEGORY_FIXES: Record<RejectionCategory, RejectionFix[]> = {
  fit: [
    {
      text: "Tighten goals and discovery filters - target roles where profile overlap is stronger.",
      module: "goals",
    },
    {
      text: "Try warm-path before cold apply on competitive roles.",
      module: "warm-path",
    },
  ],
  experience: [
    {
      text: "Add quantified bullets for the JD's seniority band in master resume.",
      module: "resume",
    },
    {
      text: "Run gap analysis and re-tailor before the next similar application.",
      module: "training",
    },
  ],
  timing: [
    {
      text: "Log outcome and set a 6-month follow-up - pipeline timing, not a skills verdict.",
      module: "goals",
    },
  ],
  formatting: [
    {
      text: "Export ATS-safe PDF; verify apply form completeness before submit.",
      module: "apply",
    },
    {
      text: "Re-check resume standards checklist (single column, plain text).",
      module: "training",
    },
  ],
  unknown: [
    {
      text: "Review ATS match % and cover letter standards for this role type.",
      module: "training",
    },
  ],
};

/**
 * Explain WHY a rejection likely happened - categorized reason + actionable fixes.
 * Pure parser grounded in email text; no LLM fabrication.
 */
export function explainRejection(emailText: string): RejectionExplanation {
  const text = emailText.toLowerCase();
  const signals: string[] = [];
  const categories = new Set<RejectionCategory>();

  for (const { category, phrases } of CATEGORY_SIGNALS) {
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        signals.push(phrase);
        categories.add(category);
      }
    }
  }

  const categoryList: RejectionCategory[] =
    categories.size > 0 ? [...categories] : ["unknown"];
  const primaryCategory = categoryList[0]!;

  const fixes: RejectionFix[] = [];
  const seen = new Set<string>();
  for (const cat of categoryList) {
    for (const fix of CATEGORY_FIXES[cat]) {
      if (!seen.has(fix.text)) {
        seen.add(fix.text);
        fixes.push(fix);
      }
    }
  }

  const summary =
    primaryCategory === "unknown"
      ? "No specific reason parsed - generic pass email. Review materials quality, not just volume."
      : `Likely rejection driver: ${categoryList.join(" + ")}. Address fixes below before re-applying to similar roles.`;

  return {
    primaryCategory,
    categories: categoryList,
    summary,
    signals,
    fixes,
    confidence: signals.length >= 2 ? "high" : signals.length === 1 ? "medium" : "low",
  };
}

export { suggestProfileFixes, failureModesForSignals };
