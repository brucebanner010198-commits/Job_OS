/**
 * Company-brief domain contract (Phase 4) - boundary shapes for a one-page,
 * factual, fully-attributed brief. DB-decoupled and Prisma-free.
 *
 * The whole module exists to enforce one rule (plan §6 / Hardening §B):
 * it is NOT enough to attach a URL to a claim - the source must actually
 * ENTAIL the claim. Anything that can't be attributed is refused, not softened.
 *
 * Pipeline shape:
 *   fetchSources(company)            -> FetchedSource[]   (lib/brief/sources)
 *   composeBrief(company, sources)   -> CompanyBriefData  (lib/brief/compose)
 *     |- entails(claim, source)      -> boolean           (lib/brief/entailment)
 *     \- classifyFact(text)          -> FactCategory + volatility (lib/brief/volatile)
 *
 * composeBrief is PURE (no LLM/DB/network) so the validation gate
 * (scripts/test-company-brief.ts) is deterministic. Network lives only inside
 * fetchSources adapters, behind the interface, always with offline fixtures.
 */

/** Where a piece of evidence came from - drives the corroboration rules. */
export type SourceKind =
  /** The company's own official site - primary, authoritative for self-claims. */
  | "official"
  /** Reputable news/press - primary for external facts. */
  | "news"
  /** Crunchbase - primary for funding/financials/headcount. Still subject to the
   *  2-independent-source rule for volatile facts (one Crunchbase source alone
   *  yields "corroborated", never "verified"). */
  | "crunchbase"
  /** Wikipedia / Wikidata - CORROBORATION ONLY (editable/vandalizable). */
  | "wiki"
  /** Other / unknown provenance - corroboration only. */
  | "other";

/** A fetched evidence document (or passage) about the company. */
export interface FetchedSource {
  url: string;
  title: string;
  kind: SourceKind;
  /** The retrieved text passage that may or may not support a given claim. */
  text: string;
  /** Retrieval timestamp - every emitted fact is stamped and stale-flagged. */
  retrievedAt: Date;
}

/** Buckets a fact falls into; volatile categories require a second source. */
export type FactCategory =
  | "overview"
  | "product"
  | "funding" // volatile
  | "headcount" // volatile
  | "leadership" // volatile
  | "culture"
  | "news"
  | "other";

export type ClaimStatus =
  /** Entailed by ≥1 primary source (and ≥2 for volatile facts). */
  | "verified"
  /** Only corroborated by wiki/other, or by a single source where 2 are required. */
  | "corroborated"
  /** Past the freshness window for a volatile fact - show but flag. */
  | "stale";

/** A single attributed fact on the brief. Refused claims never become one. */
export interface Claim {
  text: string;
  category: FactCategory;
  status: ClaimStatus;
  /** The sources that ENTAIL this claim (never merely "attached"). */
  sources: {
    url: string;
    title: string;
    kind: SourceKind;
    /** The exact passage that entails the claim. */
    snippet: string;
  }[];
  /** Most recent retrieval time across this claim's sources. */
  retrievedAt: Date;
  /** True when a volatile fact is older than the freshness window. */
  stale: boolean;
  /** True for volatile facts (funding/headcount/leadership) that need 2 sources. */
  secondSourceRequired: boolean;
}

/** A candidate claim handed to composeBrief, before verification. */
export interface CandidateClaim {
  text: string;
  category: FactCategory;
}

export interface CompanyBriefData {
  company: string;
  domain?: string;
  /** One-paragraph overview - itself attributed; empty if nothing verifies. */
  summary: string;
  /** Only entailment-passing, attribution-satisfying claims. */
  claims: Claim[];
  /** Candidate claims that were REFUSED, with why - for transparency, not display-as-fact. */
  refused: { text: string; reason: string }[];
  generatedAt: Date;
}

/** Volatile categories that require a second independent source to verify. */
export const VOLATILE_CATEGORIES: ReadonlySet<FactCategory> = new Set([
  "funding",
  "headcount",
  "leadership",
]);

/** A volatile fact older than this many days is flagged stale. */
export const FRESHNESS_DAYS = 90;
