/**
 * Candidate-claim proposer (Phase 4 - Company Brief).
 *
 * proposeCandidates is the "propose" step that feeds composeBrief's "verify"
 * step. It extracts candidate sentences from fetched sources, deduplicates
 * across sources, and tags each with a FactCategory via classifyFact.
 * composeBrief then enforces entailment, source-count, and staleness rules -
 * only entailment-passing candidates survive into the final brief.
 *
 * OFFLINE APPROACH (this file)
 * -----------------------------
 * Segment each source's text into sentences, drop very short or content-free
 * ones, deduplicate by normalized text, classify with classifyFact.
 * Proposing FROM the sources keeps the offline path honest: composeBrief
 * still applies the full entailment + 2-source + wiki/stale rules on each
 * candidate, so a sentence that only appears in a wiki source will be refused
 * by the composer regardless of how this proposer tagged it.
 *
 * PRODUCTION UPGRADE SEAM
 * -----------------------------
 * Replace the body of proposeCandidates with an LLM call via the app's
 * existing OpenRouter "companyBrief" task. Example:
 *
 *   export async function proposeCandidates(
 *     sources: FetchedSource[],
 *   ): Promise<CandidateClaim[]> {
 *     return openrouter.run("companyBrief", {
 *       prompt: buildProposalPrompt(sources),
 *     });
 *   }
 *
 * The signature is intentionally identical to the offline version so every
 * caller (lib/brief/service.ts, previewBrief, scripts/test-company-brief.ts)
 * migrates transparently. The offline heuristic remains as a fast pre-filter
 * and fallback. LLM hallucinations are still caught by composeBrief's
 * entailment guard - the LLM proposer cannot bypass the attribution rules.
 */

import { type CandidateClaim, type FetchedSource } from "@/lib/brief/types";
import { classifyFact } from "@/lib/brief/volatile";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum character length for a sentence to be considered a meaningful candidate.
 *  Filters out very short fragments like "See below." or "More info." */
const MIN_SENTENCE_LENGTH = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a text passage into sentences.
 * Uses a lookbehind on sentence-ending punctuation followed by whitespace -
 * identical to the regex in compose.ts extractSnippet for consistency.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normalize a sentence to a deduplication key.
 * Lowercases and strips all non-alphanumeric characters so minor punctuation
 * differences between sources (trailing periods, different quoting) do not
 * produce duplicate candidates for the same underlying fact.
 */
function normalizeForDedup(sentence: string): string {
  return sentence.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Propose candidate claims from a set of fetched sources.
 *
 * Algorithm:
 *   1. For each source, split its text into sentences.
 *   2. Drop sentences shorter than MIN_SENTENCE_LENGTH (fragments / boilerplate).
 *   3. Deduplicate across all sources by normalized text - the same sentence
 *      appearing in both an official press release and a news article becomes
 *      ONE candidate (composeBrief will find that both sources entail it).
 *   4. Classify each surviving sentence with classifyFact to set its category.
 *
 * The resulting CandidateClaim[] is passed to composeBrief, which verifies
 * each candidate against ALL fetched sources via entails(). Only
 * entailment-passing candidates become Claim objects on the brief; the rest
 * land in refused[].
 *
 * NOTE: This is the offline/deterministic path. For the production upgrade,
 * replace this function body with an LLM proposer (see module comment above).
 */
export function proposeCandidates(sources: FetchedSource[]): CandidateClaim[] {
  const seen = new Set<string>();
  const candidates: CandidateClaim[] = [];

  for (const source of sources) {
    const sentences = splitSentences(source.text);

    for (const sentence of sentences) {
      // Drop fragments / very short boilerplate
      if (sentence.length < MIN_SENTENCE_LENGTH) continue;

      // Deduplicate across sources
      const key = normalizeForDedup(sentence);
      if (seen.has(key)) continue;
      seen.add(key);

      candidates.push({
        text: sentence,
        category: classifyFact(sentence),
      });
    }
  }

  return candidates;
}
