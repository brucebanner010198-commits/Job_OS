/**
 * Interview transcript SCORER brain (Phase 8, plan §5).
 * Pure and DETERMINISTIC - no LLM, no DB, no network, no randomness, no
 * wall-clock reads. Given a transcript (and optionally the prep it was run
 * against) it returns a heuristic SessionScore: four 0..100 sub-scores, a
 * weighted overall, concrete per-answer STAR rewrites, short positives, and a
 * small set of UI chips. The same input always yields a deep-equal output.
 *
 * Safety spine:
 *   - DETERMINISTIC: every signal is computed from the text via stable regexes
 *     and fixed weights; turns are scanned in order and flags emitted in a fixed
 *     priority order, so two calls on the same input are byte-identical. No
 *     Math.random, no Date - nothing reads the clock.
 *   - SENSITIVE FACTS NEVER LEAVE: prep facts are only ever used to COUNT term
 *     hits, never echoed; sensitive facts are filtered out before any term is
 *     extracted, so the sensitive fixture text ("chronic health condition") can
 *     never reach a flag, a note, or a starFix. Output strings are templated and
 *     never splice in raw fact, transcript, or prep prose.
 *   - GROUNDED, NOT INVENTED: the scorer observes the candidate's own words; it
 *     rewards real STAR cues / specifics and never fabricates a metric or claim.
 */

import type {
  InterviewMode,
  PrepInput,
  ProfileFact,
  SessionScore,
  TranscriptTurn,
} from "@/lib/interview/types";

// --- Tunables -----------------------------------------------------------------

/** Below this structure score we treat the session as "weak STAR" and coach it. */
const STRUCTURE_OK = 60;

/** Filler phrases that dilute clarity (case-insensitive, word-bounded). */
const FILLER_PHRASES: readonly string[] = [
  "um",
  "uh",
  "like",
  "you know",
  "sort of",
  "kind of",
  "i guess",
  "honestly",
  "basically",
  "i mean",
];

/** Common words that carry no specificity signal when mining prep/JD terms. */
const STOPWORDS: ReadonlySet<string> = new Set([
  "with",
  "that",
  "this",
  "from",
  "year",
  "years",
  "into",
  "over",
  "their",
  "using",
  "within",
  "across",
  "your",
  "have",
  "will",
  "they",
  "them",
  "about",
  "would",
  "should",
  "required",
  "strong",
]);

// --- STAR cue detection -------------------------------------------------------

type Star = "situation" | "task" | "action" | "result";
const STAR_ORDER: readonly Star[] = ["situation", "task", "action", "result"];

/** Earliest-match cues for each STAR component (search returns a char index). */
const STAR_CUES: Record<Star, RegExp> = {
  situation:
    /\b(situation|context|background|the problem|at the time|we had|there (?:was|were)|i was (?:facing|dealing)|faced|the challenge|when our|when the)\b/i,
  task: /\b(my task|my (?:job|goal|role|responsibility|objective) was|i was (?:tasked|responsible)|i (?:needed|had) to|needed to|tasked with)\b/i,
  action:
    /\b(i (?:led|built|introduced|created|designed|implemented|rebuilt|developed|drove|owned|managed|launched|migrated|refactored|added|wrote|architected|set up)|we (?:built|introduced|implemented|designed|created|launched))\b/i,
  result:
    /\b(as a result|resulted in|the result|which (?:led|unblocked|cut|reduced|increased|improved)|outcome|impact|dropped|fell|rose|grew|saved|guaranteed|ensured|eliminated|unblocked|by \d+%|\d+%)\b/i,
};

interface TurnAnalysis {
  /** STAR components present, in canonical order. */
  present: Star[];
  /** This answer scores all four STAR parts in the right order. */
  fullStar: boolean;
  /** 0..100 structure score for this single answer. */
  structure: number;
  /** Word count of the answer. */
  words: number;
  /** Distinct number-like tokens in the answer. */
  numbers: number;
}

/** Score one candidate answer for STAR presence + ordering. */
function analyzeTurn(text: string): TurnAnalysis {
  const indices: Partial<Record<Star, number>> = {};
  for (const part of STAR_ORDER) {
    const idx = text.search(STAR_CUES[part]);
    if (idx >= 0) indices[part] = idx;
  }
  const present = STAR_ORDER.filter((p) => indices[p] !== undefined);

  // Count out-of-order pairs among the present parts (canonical vs text order).
  let inversions = 0;
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      if ((indices[present[i]] as number) > (indices[present[j]] as number)) {
        inversions++;
      }
    }
  }
  const pairs = (present.length * (present.length - 1)) / 2;
  const orderingFrac = pairs > 0 ? 1 - inversions / pairs : 1;
  const presence = present.length / STAR_ORDER.length;
  const structure = clampRound(100 * presence * (0.65 + 0.35 * orderingFrac));

  return {
    present,
    fullStar: present.length === STAR_ORDER.length && inversions === 0,
    structure,
    words: wordCount(text),
    numbers: countNumbers(text).length,
  };
}

// --- Text signal helpers ------------------------------------------------------

function wordCount(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

/** Digit / percentage / currency tokens (e.g. "40%", "$20", "5"). */
function countNumbers(text: string): string[] {
  return text.match(/\$?\d[\d,]*(?:\.\d+)?%?/g) ?? [];
}

/**
 * Capitalized multi-letter tokens that are NOT sentence-initial - a cheap proper
 * noun proxy (e.g. "Acme", "Kafka", "PostgreSQL"), dropping leading "Um"/"As".
 */
function extractProperNouns(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const tokens = sentence.split(/\s+/).slice(1); // drop the sentence's first word
    for (const raw of tokens) {
      const tok = raw.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, "");
      if (/^[A-Z][A-Za-z]+$/.test(tok)) out.push(tok);
    }
  }
  return out;
}

const RE_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** Total filler-phrase occurrences in `text` (case-insensitive, word-bounded). */
function countFiller(text: string): number {
  const lower = text.toLowerCase();
  let total = 0;
  for (const phrase of FILLER_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(RE_ESCAPE, "\\$&")}\\b`, "g");
    const m = lower.match(re);
    if (m) total += m.length;
  }
  return total;
}

/** Distinct significant tokens (len ≥ 4, non-stopword, non-numeric) in `text`. */
function significantTerms(text: string): Set<string> {
  const out = new Set<string>();
  for (const tok of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (tok.length >= 4 && !STOPWORDS.has(tok) && !/^\d+$/.test(tok)) {
      out.add(tok);
    }
  }
  return out;
}

/** How many distinct `terms` appear (as a substring) in the candidate text. */
function countTermHits(haystack: string, terms: Set<string>): number {
  let hits = 0;
  for (const term of terms) if (haystack.includes(term)) hits++;
  return hits;
}

function clampRound(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

// --- The scorer ---------------------------------------------------------------

/**
 * Score an interview transcript. Only `role === "candidate"` turns are judged.
 * `prep` (when given) supplies the company/role/JD + REAL facts used to reward
 * grounded specificity and role fit - sensitive facts are filtered out first and
 * never echoed. Deterministic: identical inputs → deep-equal output.
 */
export function scoreSession(
  transcript: TranscriptTurn[],
  mode: InterviewMode,
  prep?: PrepInput,
): SessionScore {
  const answers = transcript.filter((t) => t.role === "candidate");

  // No candidate speech → a well-formed zero score, never a throw.
  if (answers.length === 0) {
    return {
      clarity: 0,
      structure: 0,
      specificity: 0,
      fit: 0,
      overall: 0,
      starFixes: [],
      notes: [`No candidate answers to score in this ${mode} session.`],
      flags: [],
    };
  }

  const combinedLower = answers.map((t) => t.text).join(" \n ").toLowerCase();
  const perTurn = answers.map((t) => analyzeTurn(t.text));

  // -- structure: per-answer STAR, blending the average with the best answer --
  const structure = clampRound(
    0.6 * mean(perTurn.map((a) => a.structure)) +
      0.4 * Math.max(...perTurn.map((a) => a.structure)),
  );
  const fullStarAny = perTurn.some((a) => a.fullStar);

  // -- specificity: numbers + proper nouns + grounded prep-term hits ----------
  const numberSet = new Set<string>();
  const properSet = new Set<string>();
  for (const t of answers) {
    for (const n of countNumbers(t.text)) numberSet.add(n);
    for (const p of extractProperNouns(t.text)) properSet.add(p);
  }
  // EXTRACTIVE + SENSITIVE-SAFE: mine terms only from non-sensitive facts.
  const safeFacts: ProfileFact[] = (prep?.facts ?? []).filter(
    (f) => !f.sensitive,
  );
  const prepTerms = new Set<string>();
  for (const f of safeFacts) {
    for (const term of significantTerms(f.text)) prepTerms.add(term);
  }
  const numbers = numberSet.size;
  const properNouns = properSet.size;
  const prepHits = countTermHits(combinedLower, prepTerms);
  const specificity = clampRound(
    Math.min(100, numbers * 14 + properNouns * 12 + prepHits * 5),
  );

  // -- clarity: penalize filler density, too-short answers, and rambling ------
  const totalWords = perTurn.reduce((a, t) => a + t.words, 0);
  const fillerTotal = countFiller(combinedLower);
  const density = totalWords > 0 ? fillerTotal / totalWords : 0;
  const fillerPenalty = Math.min(60, Math.round(density * 350));
  const avgWords = totalWords / answers.length;
  const shortPenalty =
    avgWords < 12 ? Math.min(30, Math.round((12 - avgWords) * 3)) : 0;
  const rambleTurns = perTurn.filter(
    (a) => a.words >= 40 && a.structure < 35 && a.numbers === 0,
  ).length;
  const ramblePenalty = Math.min(30, rambleTurns * 15);
  const clarity = clampRound(100 - fillerPenalty - shortPenalty - ramblePenalty);

  // -- fit: reference to role/company/JD keywords (neutral baseline w/o prep) --
  let fit: number;
  if (prep) {
    const refTerms = new Set<string>([
      ...significantTerms(prep.company),
      ...significantTerms(prep.role ?? ""),
      ...significantTerms(prep.jobDescription ?? ""),
    ]);
    const refHits = countTermHits(combinedLower, refTerms);
    // REAL_HR weighs rapport/fit a touch more than the structured AI_SCREEN.
    const base = mode === "REAL_HR" ? 48 : 45;
    fit = clampRound(Math.min(100, base + refHits * 8));
  } else {
    fit = 50;
  }

  // -- overall: structure + specificity carry the most weight -----------------
  const overall = clampRound(
    0.3 * structure + 0.3 * specificity + 0.2 * clarity + 0.2 * fit,
  );

  // -- flags: only real chips, in a fixed priority order ----------------------
  const flags: string[] = [];
  if (fullStarAny) flags.push("strong STAR");
  if (specificity >= 60) flags.push("specific");
  if (fillerTotal >= 3 || density >= 0.05) flags.push("filler");
  if (numbers === 0) flags.push("no metrics");
  if (specificity < 35) flags.push("vague");
  if (rambleTurns > 0) flags.push("rambling");

  // -- starFixes: concrete per-answer rewrites when structure is weak ---------
  const starFixes: string[] = [];
  if (structure < STRUCTURE_OK) {
    answers.forEach((_, i) => {
      const missing = STAR_ORDER.filter((p) => !perTurn[i].present.includes(p));
      if (missing.length > 0) {
        const labels = missing
          .map((m) => m.charAt(0).toUpperCase() + m.slice(1))
          .join(", ");
        starFixes.push(
          `Answer ${i + 1}: add the missing ${labels}. Reframe in STAR order - ` +
            `set the Situation, state your Task, walk through the Actions you ` +
            `took, then close with a measurable Result.`,
        );
      }
    });
    if (starFixes.length === 0) {
      starFixes.push(
        "Tighten each answer into STAR order - Situation, Task, Action, " +
          "Result - and end on a measurable outcome.",
      );
    }
  }

  // -- notes: short, honest observations --------------------------------------
  const notes: string[] = [];
  notes.push(
    `Scored ${answers.length} candidate answer${
      answers.length === 1 ? "" : "s"
    } in a ${mode} session.`,
  );
  if (fullStarAny) notes.push("At least one answer follows a clear STAR arc.");
  if (specificity >= 60) {
    notes.push("Answers carry concrete specifics - numbers and named systems.");
  }
  if (numbers === 0) {
    notes.push("No quantified outcomes - add metrics to make the impact land.");
  }
  if (flags.includes("filler")) {
    notes.push("Filler words dilute the delivery - trim them.");
  }

  return {
    clarity,
    structure,
    specificity,
    fit,
    overall,
    starFixes,
    notes,
    flags,
  };
}
