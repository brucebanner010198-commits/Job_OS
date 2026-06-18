/**
 * Brief composer - pure entailment-checked citation engine (Phase 4).
 *
 * This is the gating layer that implements plan §6 / Hardening §B:
 * every emitted Claim is backed by at least one source that ACTUALLY ENTAILS it.
 * Anything that can't be attributed is refused, never softened into an unattributed claim.
 *
 * Rules:
 *   1. No entailing PRIMARY source → REFUSE.
 *   2. Volatile category (funding/headcount/leadership):
 *        ≥ 2 independent entailing primary sources → "verified"
 *        exactly 1                                 → "corroborated" (secondSourceRequired=true)
 *   3. Non-volatile, ≥ 1 entailing primary source → "verified".
 *   4. Wiki/other entailment only (no primary)    → REFUSE.
 *   5. If a volatile verified/corroborated claim's most-recent source is stale → "stale".
 *
 * "Independent" = different URL (domain-level deduplication would be stricter, but
 * URL is the observable unit here). Wiki and "other" kind never count toward the
 * primary source quota - they can only corroborate.
 *
 * Pure: no LLM, no network, no DB, no Math.random, no Date.now.
 */

import {
  type CandidateClaim,
  type Claim,
  type ClaimStatus,
  type CompanyBriefData,
  type FetchedSource,
} from "@/lib/brief/types";
import { entails } from "@/lib/brief/entailment";
import { classifyFact, isVolatile, isStale } from "@/lib/brief/volatile";
import { sanitizePromptText } from "@/lib/security/prompt-sanitize";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Primary kinds - count toward the 2-source volatile verification rule.
 *  Crunchbase is primary for financial facts, but a SINGLE crunchbase source
 *  still only yields "corroborated" for a volatile claim (the independent-URL
 *  rule in step 5 enforces that), so this never weakens the guard. */
export function isPrimary(kind: FetchedSource["kind"]): boolean {
  return kind === "official" || kind === "news" || kind === "crunchbase";
}

/**
 * Extract the entailing snippet from a source for a given claim.
 * Returns the shortest sentence/passage in the source that contains the
 * highest density of claim tokens. Fallback: first 200 characters.
 */
function extractSnippet(claim: string, sourceText: string): string {
  const sentences = sourceText.split(/(?<=[.!?])\s+/);
  const claimLower = claim.toLowerCase();
  const claimWords = claimLower.split(/\s+/).filter((w) => w.length > 3);

  let bestSentence = "";
  let bestHits = -1;

  for (const sentence of sentences) {
    const sl = sentence.toLowerCase();
    const hits = claimWords.filter((w) => sl.includes(w)).length;
    if (hits > bestHits) {
      bestHits = hits;
      bestSentence = sentence;
    }
  }

  return bestSentence.trim() || sourceText.slice(0, 200);
}

/** Most recent Date across an array of sources. */
function maxDate(sources: FetchedSource[]): Date {
  return sources.reduce((max, s) => (s.retrievedAt > max ? s.retrievedAt : max), sources[0].retrievedAt);
}

// ---------------------------------------------------------------------------
// Core composer
// ---------------------------------------------------------------------------

export function composeBrief(input: {
  company: { name: string; domain?: string };
  candidates: CandidateClaim[];
  sources: FetchedSource[];
  now: Date;
}): CompanyBriefData {
  const { company, candidates, sources, now } = input;

  const safeSources = sources.map((s) => ({
    ...s,
    text: sanitizePromptText(s.text),
  }));
  const safeCandidates = candidates.map((c) => ({
    ...c,
    text: sanitizePromptText(c.text),
  }));

  const claims: Claim[] = [];
  const refused: { text: string; reason: string }[] = [];

  for (const candidate of safeCandidates) {
    // Step 1: find all sources that entail this claim
    const entailingSources = safeSources.filter((s) =>
      entails(candidate.text, s.text),
    );

    // Step 2: classify category (use candidate.category if provided, verify with heuristic)
    // We trust the caller-supplied category (CandidateClaim has it), so use it directly.
    const category = candidate.category;
    const volatile = isVolatile(category);

    // Step 3: partition entailing sources into primary vs corroboration
    const primarySources = entailingSources.filter((s) => isPrimary(s.kind));
    const corrSources = entailingSources.filter((s) => !isPrimary(s.kind));

    // Step 4: apply refusal rules
    if (primarySources.length === 0) {
      if (corrSources.length > 0) {
        refused.push({
          text: candidate.text,
          reason:
            "Only wiki/other sources entail this claim - corroboration cannot stand alone without a primary (official/news) source.",
        });
      } else {
        refused.push({
          text: candidate.text,
          reason: "No source entails this claim.",
        });
      }
      continue;
    }

    // Step 5: determine independent primary sources (unique by URL)
    const seenUrls = new Set<string>();
    const independentPrimary: FetchedSource[] = [];
    for (const s of primarySources) {
      if (!seenUrls.has(s.url)) {
        seenUrls.add(s.url);
        independentPrimary.push(s);
      }
    }

    // Step 6: compute status
    let status: ClaimStatus;
    if (volatile) {
      if (independentPrimary.length >= 2) {
        status = "verified";
      } else {
        // Exactly 1 independent primary - emit as "corroborated" so user sees it flagged
        status = "corroborated";
      }
    } else {
      status = "verified";
    }

    // Step 7: staleness - applies to volatile claims (or any claim with volatile sources)
    // Use the most-recent retrieval across all entailing primary sources.
    const retrievedAt = maxDate(independentPrimary);
    const stale = volatile && isStale(retrievedAt, now);
    if (stale && (status === "verified" || status === "corroborated")) {
      status = "stale";
    }

    // Step 8: build the Claim - only include entailing sources
    const claimSources = [
      ...independentPrimary,
      ...corrSources.filter((s, i, arr) => arr.findIndex((x) => x.url === s.url) === i),
    ].map((s) => ({
      url: s.url,
      title: s.title,
      kind: s.kind,
      snippet: extractSnippet(candidate.text, s.text),
    }));

    claims.push({
      text: candidate.text,
      category,
      status,
      sources: claimSources,
      retrievedAt,
      stale,
      secondSourceRequired: volatile,
    });
  }

  // Step 9: build summary from verified non-volatile overview/product claims only
  const summaryParts = claims
    .filter(
      (c) =>
        c.status === "verified" &&
        !c.stale &&
        (c.category === "overview" || c.category === "product"),
    )
    .map((c) => c.text);
  const summary = summaryParts.join(" ");

  return {
    company: company.name,
    domain: company.domain,
    summary,
    claims,
    refused,
    generatedAt: now,
  };
}
