/**
 * Study-guide BRAIN (Phase 8, plan §5) - turns a prep target plus the user's
 * REAL profile facts into the always-free offline core of a prep: the top-5
 * likely questions, each with an EXTRACTIVE STAR model answer assembled only
 * from real facts.
 *
 * Pure - no LLM, no DB, no network, no wall-clock. Deterministic: a stable
 * relevance ranking over facts and a fixed category order, so the same prep
 * always yields the byte-identical guide.
 *
 * Safety spine (plan §5, Hardening §A/§B):
 *   - EXTRACTIVE: every model answer is built ONLY from real ProfileFact text
 *     plus thin connective scaffolding. It never invents a metric, a company,
 *     or an experience; an answer that can't be grounded leaves usedFactIds
 *     empty and the guide sets provenanceOk=false.
 *   - SENSITIVE FACTS NEVER LEAVE: facts flagged `sensitive` are filtered out
 *     BEFORE any selection, counted in withheldSensitive, and can therefore
 *     never reach a question, a model answer, a STAR part, or a tip.
 */
import type {
  PrepInput,
  ProfileFact,
  QAItem,
  QuestionCategory,
  StarParts,
  StudyGuide,
} from "@/lib/interview/types";
import { STUDY_QUESTION_TARGET } from "@/lib/interview/types";

/** How many real facts a single grounded answer may draw on (primary + support). */
const FACTS_PER_QUESTION = 2;

/** Light per-kind tiebreak so concrete experience outranks a bare skill on ties. */
const KIND_BONUS: Record<string, number> = {
  EXPERIENCE: 0.4,
  PROJECT: 0.3,
  ACHIEVEMENT: 0.2,
  SKILL: 0.1,
};

// --- Question specialization context -----------------------------------------

/** The thin, prep-derived inputs a canonical question is specialized with. */
interface SpecializeCtx {
  roleLabel: string;
  company: string;
  /** A display label for the job's top focus area, or null when no JD. */
  jdFocus: string | null;
}

/** One canonical bank question: its category, ranking keywords, text, and tip. */
interface BankEntry {
  category: QuestionCategory;
  /** Words used to rank facts for this question (drives extractive selection). */
  keywords: string[];
  /** Builds the lightly specialized question text from the prep context. */
  question: (ctx: SpecializeCtx) => string;
  /** A short delivery-coaching line (static; never references a fact). */
  tip: string;
}

/**
 * The canonical question bank - exactly one entry per category, in a fixed
 * order, so a guide always spans all five distinct categories deterministically.
 */
const BANK: BankEntry[] = [
  {
    category: "BEHAVIORAL",
    keywords: [
      "led",
      "built",
      "reduced",
      "improved",
      "project",
      "team",
      "impact",
      "challenge",
    ],
    question: () =>
      "Tell me about the most challenging project you've led, and the impact you delivered.",
    tip: "Lead with the result, then unpack the STAR detail; keep it under two minutes.",
  },
  {
    category: "ROLE_SPECIFIC",
    keywords: [
      "design",
      "api",
      "systems",
      "architecture",
      "throughput",
      "distributed",
      "scale",
      "performance",
    ],
    question: ({ roleLabel, company, jdFocus }) =>
      `What in your background makes you a strong ${roleLabel} at ${company}` +
      (jdFocus ? `, especially around ${jdFocus}?` : "?"),
    tip: "Map each point to the role's requirements - name the skill, then the proof.",
  },
  {
    category: "COMPANY_FIT",
    keywords: [
      "reliability",
      "uptime",
      "quality",
      "ownership",
      "platform",
      "customer",
      "scale",
    ],
    question: ({ company }) =>
      `Why ${company}, and how would you contribute to the team here?`,
    tip: "Show you've done your homework: tie a real strength to something specific about the team.",
  },
  {
    category: "MOTIVATION",
    keywords: [
      "mentor",
      "growth",
      "learn",
      "ownership",
      "impact",
      "promoted",
      "team",
    ],
    question: ({ roleLabel, company }) =>
      `What motivates you day to day, and why pursue ${roleLabel} at ${company} now?`,
    tip: "Be genuine and concrete; connect what energizes you to what this role actually offers.",
  },
  {
    category: "SITUATIONAL",
    keywords: [
      "incident",
      "reliability",
      "load",
      "latency",
      "outage",
      "failure",
      "scale",
      "throughput",
    ],
    question: ({ jdFocus }) =>
      `Walk me through how you'd handle a high-stakes ${
        jdFocus ?? "reliability or scaling"
      } problem under real time pressure.`,
    tip: "Think out loud and structure it: clarify, prioritize, act, then verify.",
  },
];

// Invariant: the bank holds exactly the target number of questions (one per
// category). Keeps "produce EXACTLY STUDY_QUESTION_TARGET questions" honest.
if (BANK.length !== STUDY_QUESTION_TARGET) {
  throw new Error("study bank size must equal STUDY_QUESTION_TARGET");
}

// --- Job-description focus extraction (light specialization) ------------------

/** A JD topic we recognize: a lowercase `match` to scan for + a display `label`. */
interface JdKeyword {
  match: string;
  label: string;
}

const JD_KEYWORDS: JdKeyword[] = [
  { match: "distributed", label: "distributed systems" },
  { match: "reliability", label: "reliability" },
  { match: "latency", label: "latency" },
  { match: "throughput", label: "throughput" },
  { match: "observability", label: "observability" },
  { match: "scal", label: "scale" },
  { match: "platform", label: "platform services" },
  { match: "payment", label: "payments" },
  { match: "postgres", label: "PostgreSQL" },
  { match: "api", label: "API design" },
  { match: "developer", label: "developer experience" },
];

/** The display label of the JD's top recognized focus, or null when no JD. */
function jdFocusOf(jobDescription: string | undefined): string | null {
  if (!jobDescription) return null;
  const low = jobDescription.toLowerCase();
  const hit = JD_KEYWORDS.find((k) => low.includes(k.match));
  return hit ? hit.label : null;
}

// --- Extractive fact ranking --------------------------------------------------

/** Lowercase a string into alphanumeric tokens (length ≥ 2). */
function tokenize(text: string | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

function kindBonus(kind: string): number {
  return KIND_BONUS[kind] ?? 0;
}

/** Count how many of `query` tokens appear in `factTokens`. */
function overlap(factTokens: Set<string>, query: Set<string>): number {
  let hits = 0;
  for (const t of query) if (factTokens.has(t)) hits++;
  return hits;
}

/**
 * Rank non-sensitive facts for one question, fully deterministically. The
 * per-category `keywords` are the dominant signal (1 point each); the role /
 * company / JD `context` only lightly steers selection (≤0.45 total) so it
 * never overtakes a single real keyword match; the kind bonus (≤0.4) and then
 * original order break the remaining ties.
 */
function rankFacts(
  facts: ProfileFact[],
  keywords: string[],
  context: string[],
): ProfileFact[] {
  const keywordSet = new Set(keywords);
  const contextSet = new Set(context);
  return facts
    .map((fact, index) => {
      const factTokens = new Set(tokenize(fact.text));
      const keywordScore = overlap(factTokens, keywordSet);
      const contextScore = Math.min(overlap(factTokens, contextSet), 9) * 0.05;
      return {
        fact,
        index,
        score: keywordScore + contextScore + kindBonus(fact.kind),
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.fact);
}

// --- STAR assembly (extractive) -----------------------------------------------

/** Lowercase the first character so a fact can be embedded mid-sentence. */
function lowerLead(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** First quantified result in the text (e.g. "40%", "$20M", "5M"), or null. */
function metricIn(text: string): string | null {
  const m = text.match(/\$\d[\d.,]*[MKB]?|\d[\d.,]*%|\d[\d.,]*[MKB]\b/i);
  return m ? m[0] : null;
}

/** A grounded STAR scaffold built ONLY from the chosen real facts. */
function groundedStar(facts: ProfileFact[]): StarParts {
  const primary = facts[0];
  const secondary = facts[1];
  const metric =
    metricIn(primary.text) ?? (secondary ? metricIn(secondary.text) : null);
  return {
    situation: `Here is a real, directly relevant example from my own experience: ${primary.text}`,
    task: "The task I owned was to turn that into measurable impact, not just activity.",
    action: secondary
      ? `Concretely, I also ${lowerLead(secondary.text)}`
      : "Concretely, I drove it end to end and owned the outcome myself.",
    result: metric
      ? `The measurable result: ${metric}.`
      : "The result was a concrete, measurable improvement I could point to.",
  };
}

/** A generic, NON-grounded scaffold used when no real facts are available. */
function blankStar(): StarParts {
  return {
    situation:
      "Fill this in with a real example from your experience - the Situation you faced.",
    task: "The Task you owned and what success looked like.",
    action: "The Action you personally took.",
    result: "The measurable Result, with real numbers.",
  };
}

/** Flatten a STAR scaffold into the flowing model-answer prose the UI shows. */
function starToProse(star: StarParts): string {
  return [star.situation, star.task, star.action, star.result].join(" ");
}

// --- Public brain -------------------------------------------------------------

/**
 * Build the deterministic study guide for one prep. Always emits exactly
 * STUDY_QUESTION_TARGET questions spanning all five categories. With real facts
 * the answers are grounded in those real facts (provenanceOk=true); with none they are
 * generic fill-in scaffolds (usedFactIds=[], provenanceOk=false). Sensitive
 * facts are withheld up front and never appear anywhere in the output.
 */
export function buildStudyGuide(prep: PrepInput): StudyGuide {
  // Defense in depth: drop sensitive facts BEFORE any selection runs.
  const nonSensitive = prep.facts.filter((f) => !f.sensitive);
  const withheldSensitive = prep.facts.length - nonSensitive.length;

  const ctx: SpecializeCtx = {
    roleLabel: prep.role && prep.role.trim() ? prep.role.trim() : "this role",
    company: prep.company,
    jdFocus: jdFocusOf(prep.jobDescription),
  };

  // Role/company/JD tokens lightly steer every question's fact selection.
  const baseQuery = [
    ...tokenize(prep.role),
    ...tokenize(prep.company),
    ...tokenize(prep.jobDescription),
  ];

  const questions: QAItem[] = BANK.map((entry) => {
    const chosen = nonSensitive.length
      ? rankFacts(nonSensitive, entry.keywords, baseQuery).slice(
          0,
          FACTS_PER_QUESTION,
        )
      : [];
    const star = chosen.length ? groundedStar(chosen) : blankStar();
    return {
      question: entry.question(ctx),
      category: entry.category,
      modelAnswer: starToProse(star),
      starParts: star,
      usedFactIds: chosen.map((f) => f.id),
      tip: entry.tip,
    };
  });

  // Grounded iff real facts existed AND every answer drew on ≥1 of them.
  const provenanceOk =
    nonSensitive.length > 0 && questions.every((q) => q.usedFactIds.length > 0);

  return {
    company: prep.company,
    role: prep.role,
    questions,
    provenanceOk,
    withheldSensitive,
  };
}
