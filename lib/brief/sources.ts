/**
 * Source fixtures and fetch seam (Phase 4 - Company Brief).
 *
 * Two fixture companies are defined to exercise every verification rule:
 *
 *   Acme AI (company A)
 *   ------------------
 *   • Official site passage → entails overview claim (non-volatile → "verified").
 *   • News passage → entails funding claim.
 *   • Second independent official passage → ALSO entails same funding claim.
 *     Result: volatile funding claim has 2 independent primary sources → "verified".
 *   • Wiki passage → entails product claim ONLY.
 *     Result: wiki-only entailment → never "verified" (corroboration only).
 *   • A passage that does NOT entail a particular candidate claim → that claim refused.
 *
 *   BetaCorp (company B)
 *   --------------------
 *   • News passage → entails headcount claim (volatile).
 *   • NO second independent source for the same headcount claim.
 *     Result: single-source volatile claim → "corroborated" (not verified).
 *   • Leadership claim on a source whose retrievedAt > FRESHNESS_DAYS ago → stale.
 *
 * PRODUCTION UPGRADE SEAM
 * ------------------------
 * Replace `fetchSources` with real I/O:
 *   1. GET company domain (official), classify as "official".
 *   2. Search news API (e.g. app's existing fetch layer), classify as "news".
 *   3. Optionally query Wikipedia, classify as "wiki" - never as primary.
 *   4. Deduplicate by (url, domain) before returning.
 * The offline fixture path (`briefFixtures[company.name] ?? []`) remains as
 * the deterministic test stub. Make the live path a separate adapter module
 * and inject it so composeBrief stays pure (it receives FetchedSource[], not a fetcher).
 *
 * No network calls here. Pure, deterministic offline fixtures.
 */

import { type FetchedSource } from "@/lib/brief/types";
import { fetchOfficialSite } from "@/lib/brief/source-official";
import { fetchNewsArticles } from "@/lib/brief/source-news";
import { fetchWikipassage } from "@/lib/brief/source-wiki";
import { fetchWebResearchSources } from "@/lib/brief/source-web-research";
import { fetchEdgarSources } from "@/lib/brief/source-edgar";
import { fetchWikidataSources } from "@/lib/brief/source-wikidata";

// ---------------------------------------------------------------------------
// Reference "now" for freshness: we define a recent date and a stale date
// relative to FRESHNESS_DAYS (90 days). Tests supply their own `now`.
// ---------------------------------------------------------------------------

/** A recent retrieval - well within the freshness window. */
const RECENT: Date = new Date("2026-05-01T00:00:00Z");

/** A stale retrieval - 120 days before a test "now" of 2026-06-16. */
const STALE: Date = new Date("2026-02-16T00:00:00Z");   // 120 days before 2026-06-16

// ---------------------------------------------------------------------------
// Acme AI fixtures
// ---------------------------------------------------------------------------

const ACME_OFFICIAL_OVERVIEW: FetchedSource = {
  url: "https://acmeai.com/about",
  title: "About Acme AI",
  kind: "official",
  text:
    "Acme AI is an enterprise artificial intelligence platform that helps businesses " +
    "automate decision-making workflows using machine learning. Founded in 2018, the " +
    "company provides AI-powered software tools for data analytics, predictive modeling, " +
    "and intelligent automation across industries including finance, healthcare, and retail.",
  retrievedAt: RECENT,
};

/** Entails the funding claim - news source 1 of 2. */
const ACME_NEWS_FUNDING: FetchedSource = {
  url: "https://techcrunch.com/2026/04/acme-ai-series-b",
  title: "Acme AI raises $50 million Series B",
  kind: "news",
  text:
    "Acme AI announced today that it has raised $50 million in a Series B funding round " +
    "led by General Catalyst. The round brings total funding to $75 million. The San " +
    "Francisco-based AI startup plans to use the capital to expand its enterprise sales " +
    "team and accelerate product development.",
  retrievedAt: RECENT,
};

/** Entails the SAME funding claim - official source 2 of 2 (independent domain). */
const ACME_OFFICIAL_FUNDING: FetchedSource = {
  url: "https://acmeai.com/press/series-b",
  title: "Acme AI Series B Press Release",
  kind: "official",
  text:
    "We are thrilled to announce Acme AI has raised $50 million in Series B funding. " +
    "This investment from General Catalyst and existing investors reflects our momentum " +
    "in delivering AI automation solutions to enterprise customers worldwide.",
  retrievedAt: RECENT,
};

/**
 * Wiki source - entails a product claim.
 * Per the rules: wiki is corroboration-only, never counts as a primary source.
 */
const ACME_WIKI: FetchedSource = {
  url: "https://en.wikipedia.org/wiki/Acme_AI",
  title: "Acme AI - Wikipedia",
  kind: "wiki",
  text:
    "Acme AI is a software company that develops artificial intelligence automation tools " +
    "and machine learning platform products. Its flagship product is an enterprise AI " +
    "platform offering predictive analytics and workflow automation. The company is " +
    "headquartered in San Francisco, California.",
  retrievedAt: RECENT,
};

/**
 * A passage about an UNRELATED topic - does NOT entail the candidate claim
 * "Acme AI has 500 employees" (no headcount mention, no matching tokens).
 */
const ACME_UNRELATED: FetchedSource = {
  url: "https://acmeai.com/blog/2026/q1-product-updates",
  title: "Acme AI Q1 Product Updates",
  kind: "official",
  text:
    "This quarter we shipped improved dashboard visualizations and a redesigned onboarding " +
    "flow. Our engineering team focused on performance improvements to the core inference " +
    "pipeline, reducing latency by 30 percent.",
  retrievedAt: RECENT,
};

// ---------------------------------------------------------------------------
// BetaCorp fixtures
// ---------------------------------------------------------------------------

/**
 * Entails headcount claim - only ONE source exists for BetaCorp headcount
 * (volatile category). Result: single-source volatile → "corroborated", NOT verified.
 */
const BETACORP_NEWS_HEADCOUNT: FetchedSource = {
  url: "https://forbes.com/betacorp-2026-growth",
  title: "BetaCorp Doubles Headcount in 2026",
  kind: "news",
  text:
    "BetaCorp, the cloud infrastructure startup, now employs 1200 people across its " +
    "engineering and operations teams, up from 600 at the start of the year. The company " +
    "attributes rapid headcount growth to strong enterprise demand for its platform.",
  retrievedAt: RECENT,
};

/**
 * BetaCorp official overview - non-volatile claim source.
 */
const BETACORP_OFFICIAL_OVERVIEW: FetchedSource = {
  url: "https://betacorp.io/about",
  title: "About BetaCorp",
  kind: "official",
  text:
    "BetaCorp is a cloud infrastructure company providing scalable compute and storage " +
    "solutions for enterprise customers. The platform enables organizations to deploy " +
    "containerized workloads with high reliability and global reach.",
  retrievedAt: RECENT,
};

/**
 * Stale leadership source - retrievedAt is STALE (> FRESHNESS_DAYS before test now).
 * Entails "Jane Smith was appointed CEO of BetaCorp" - volatile, and stale.
 */
const BETACORP_STALE_LEADERSHIP: FetchedSource = {
  url: "https://betacorp.io/press/ceo-announcement",
  title: "BetaCorp Appoints Jane Smith as CEO",
  kind: "official",
  text:
    "BetaCorp today announced that Jane Smith has been appointed CEO, effective immediately. " +
    "Smith, a veteran technology executive, was hired as chief executive to lead the " +
    "company's next phase of growth. The board unanimously approved the appointment.",
  retrievedAt: STALE,
};

// ---------------------------------------------------------------------------
// Exported fixtures map
// ---------------------------------------------------------------------------

export const briefFixtures: Record<string, FetchedSource[]> = {
  "Acme AI": [
    ACME_OFFICIAL_OVERVIEW,
    ACME_NEWS_FUNDING,
    ACME_OFFICIAL_FUNDING,
    ACME_WIKI,
    ACME_UNRELATED,
  ],
  BetaCorp: [
    BETACORP_OFFICIAL_OVERVIEW,
    BETACORP_NEWS_HEADCOUNT,
    BETACORP_STALE_LEADERSHIP,
  ],
};

// ---------------------------------------------------------------------------
// Fetch seam (offline stub - wire real adapters here for production)
// ---------------------------------------------------------------------------

/**
 * Returns sources for a company. Offline: returns fixture data.
 *
 * PRODUCTION SEAM: replace the body with:
 *   const official = await fetchOfficialSite(company.domain);
 *   const news     = await fetchNewsArticles(company.name);
 *   const wiki     = await fetchWikipassage(company.name);  // kind: "wiki"
 *   return [...official, ...news, ...wiki];
 *
 * Constraints for the real implementation:
 *   - Never classify Wikipedia as kind "official" or "news".
 *   - Deduplicate by URL.
 *   - Record retrievedAt = new Date() at fetch time.
 *   - Do not call this function from composeBrief - pass the result in.
 */
export async function fetchSources(
  company: { name: string; domain?: string },
): Promise<FetchedSource[]> {
  const fixtures = briefFixtures[company.name] ?? [];

  // Live adapters - parallel, never throw. Fixtures remain for offline tests.
  const [official, news, wiki, webResearch, edgar, wikidata] = await Promise.all([
    fetchOfficialSite(company),
    fetchNewsArticles(company),
    fetchWikipassage(company),
    fetchWebResearchSources(company),
    fetchEdgarSources(company),
    fetchWikidataSources(company),
  ]);

  const live = [...official, ...news, ...wiki, ...webResearch, ...edgar, ...wikidata];

  // Deduplicate by URL (production constraint).
  const seen = new Set<string>();
  const merged: FetchedSource[] = [];
  for (const src of [...live, ...fixtures]) {
    const key = src.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(src);
  }

  return merged;
}
