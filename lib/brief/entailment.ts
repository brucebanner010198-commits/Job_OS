/**
 * Deterministic offline entailment guard (Phase 4 - Company Brief).
 *
 * PURPOSE
 * -------
 * This is the core of plan §6 / Hardening §B: it is not enough to ATTACH a URL
 * to a claim. This guard verifies the source text ACTUALLY ENTAILS the claim
 * before any fact is emitted.
 *
 * HOW IT WORKS (heuristic, offline)
 * ----------------------------------
 * 1. CONTENT-TOKEN OVERLAP - the claim's meaningful (non-stopword) tokens must
 *    appear substantially in the source (threshold: ≥ 0.70 of claim tokens found).
 * 2. NUMBER MATCH - every numeric/monetary value in the claim must be present in
 *    the source after normalization (e.g. "$50M" ↔ "50 million" ↔ "$50 million").
 *    A claim that introduces a number the source doesn't contain is the classic
 *    hallucination / fabrication vector - it fails entailment unconditionally.
 * 3. NEGATION GUARD - if the source negates the claim's key predicate (using
 *    "not", "no longer", "former", "denied", "never" etc. near the matched terms)
 *    the claim is considered contradicted, not entailed.
 *
 * PRODUCTION UPGRADE SEAM
 * ------------------------
 * Replace `entails(claim, sourceText)` with an LLM call (e.g. via the app's
 * existing OpenRouter "companyBrief" task). The SIGNATURE is intentionally
 * identical to the offline version so every caller migrates transparently.
 * The offline heuristic remains as a fast pre-filter / fallback.
 *
 * No LLM, no network, no Math.random. Pure deterministic text logic.
 */

// ---------------------------------------------------------------------------
// Stopwords (shared shape with relevance.ts but kept local - no cross-module dep)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "your", "our", "are", "will", "have",
  "has", "this", "that", "from", "but", "not", "all", "can", "who", "what",
  "their", "them", "they", "his", "her", "its", "out", "into", "over", "more",
  "most", "such", "than", "then", "now", "via", "per", "able", "across",
  "a", "an", "as", "at", "be", "by", "in", "is", "it", "of", "on", "or", "to",
  "we", "us", "i", "was", "were", "been", "being", "do", "does", "did",
  "said", "says", "about", "also", "which", "when", "where", "how",
  "company", "firm", "based",
]);

const TOKEN_OVERLAP_THRESHOLD = 0.70;

// ---------------------------------------------------------------------------
// Number normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise a numeric/money string to a canonical set of integer representations.
 *
 * Maps:
 *   "$50M"        → ["50000000", "50", "50m"]
 *   "50 million"  → ["50000000", "50", "50m"]
 *   "$50 million" → ["50000000", "50", "50m"]
 *   "1,200"       → ["1200"]
 *   "2019"        → ["2019"]
 *
 * Returns a Set of strings so we can do cross-form matching.
 */
function normaliseNumber(raw: string): Set<string> {
  const result = new Set<string>();
  // Strip currency symbols and commas
  const cleaned = raw.replace(/[$,]/g, "").trim().toLowerCase();

  const multipliers: Record<string, number> = {
    k: 1_000,
    thousand: 1_000,
    m: 1_000_000,
    million: 1_000_000,
    b: 1_000_000_000,
    billion: 1_000_000_000,
  };

  // Match pattern: number + optional multiplier word/letter
  const match = cleaned.match(/^([\d.]+)\s*(k|thousand|m|million|b|billion)?$/);
  if (match) {
    const base = parseFloat(match[1]);
    const suffix = match[2] ?? "";
    const mult = multipliers[suffix] ?? 1;
    const expanded = Math.round(base * mult);
    result.add(String(expanded));
    result.add(String(Math.round(base))); // bare number
    if (suffix) result.add(`${Math.round(base)}${suffix[0]}`); // e.g. "50m"
  } else {
    // plain number (year, headcount, etc.)
    result.add(cleaned);
  }
  return result;
}

/**
 * Extract all numeric tokens from text (numbers, money amounts, years).
 * Returns raw strings as found (pre-normalisation).
 */
function extractNumbers(text: string): string[] {
  // Match: optional $ + digits + optional ,digits + optional decimal + optional suffix
  const re = /\$?[\d,]+(?:\.\d+)?\s*(?:million|billion|thousand|[kmb])\b|\$?[\d,]+(?:\.\d+)?/gi;
  return (text.match(re) ?? []).map((s) => s.trim());
}

// ---------------------------------------------------------------------------
// Negation guard
// ---------------------------------------------------------------------------

/**
 * Returns true if the source text NEGATES a claim predicate near matched terms.
 * "Near" = within 8 tokens of a negation word.
 */
const NEGATION_WORDS = new Set([
  "not", "no", "never", "nor", "neither", "without",
  "no longer", "former", "formerly", "denied", "deny",
  "refuted", "incorrect", "false", "wrong", "misleading",
  "resigned", "departed", "left", "fired",
]);

function hasNegationNearMatches(claim: string, sourceText: string): boolean {
  const claimTokens = contentTokens(claim);
  if (claimTokens.size === 0) return false;

  const srcWords = sourceText.toLowerCase().split(/\s+/);
  const WINDOW = 8;

  for (let i = 0; i < srcWords.length; i++) {
    const word = srcWords[i].replace(/[^a-z]/g, "");
    if (!NEGATION_WORDS.has(word)) continue;

    // Check if any claim token appears within WINDOW tokens of this negation
    for (let j = Math.max(0, i - WINDOW); j <= Math.min(srcWords.length - 1, i + WINDOW); j++) {
      const nearby = srcWords[j].replace(/[^a-z0-9]/g, "");
      if (claimTokens.has(nearby)) return true;
    }
  }

  // Also check multi-word negation phrases
  const srcLower = sourceText.toLowerCase();
  const multiWordNeg = ["no longer", "not a", "not the", "never was", "formerly"];
  for (const phrase of multiWordNeg) {
    if (!srcLower.includes(phrase)) continue;
    const idx = srcLower.indexOf(phrase);
    const surrounding = srcLower.slice(Math.max(0, idx - 60), idx + 60 + phrase.length);
    for (const tok of claimTokens) {
      if (surrounding.includes(tok)) return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/** Extract meaningful (non-stopword) tokens from text. */
function contentTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 2) continue;
    if (STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The [0, 1] token overlap score that `entails` thresholds on.
 * Exported for transparency and unit tests.
 *
 * Score = |claim_content_tokens ∩ source_content_tokens| / |claim_content_tokens|
 * (recall-of-claim orientation: how much of the claim does the source cover)
 */
export function entailmentScore(claim: string, sourceText: string): number {
  const claimToks = contentTokens(claim);
  if (claimToks.size === 0) return 0;
  const srcToks = contentTokens(sourceText);
  if (srcToks.size === 0) return 0;

  let hits = 0;
  for (const t of claimToks) {
    if (srcToks.has(t)) hits++;
  }
  return hits / claimToks.size;
}

/**
 * Returns true ONLY when sourceText genuinely supports the claim.
 *
 * Three-part check (ALL must pass):
 *   1. Token overlap ≥ 0.70
 *   2. Every number in the claim is present in the source (after normalisation)
 *   3. The source does NOT negate the claim's key predicate
 */
export function entails(claim: string, sourceText: string): boolean {
  // Gate 1: token overlap
  const score = entailmentScore(claim, sourceText);
  if (score < TOKEN_OVERLAP_THRESHOLD) return false;

  // Gate 2: number match - every number in the claim must appear in the source
  const claimNums = extractNumbers(claim);
  if (claimNums.length > 0) {
    const srcNums = extractNumbers(sourceText);
    // Build a flat set of all normalised forms from the source
    const srcNormForms = new Set<string>();
    for (const n of srcNums) {
      for (const form of normaliseNumber(n)) srcNormForms.add(form);
    }
    for (const cn of claimNums) {
      const claimForms = normaliseNumber(cn);
      let found = false;
      for (const form of claimForms) {
        if (srcNormForms.has(form)) { found = true; break; }
      }
      if (!found) return false; // claim number absent from source → not entailed
    }
  }

  // Gate 3: negation guard
  if (hasNegationNearMatches(claim, sourceText)) return false;

  return true;
}
