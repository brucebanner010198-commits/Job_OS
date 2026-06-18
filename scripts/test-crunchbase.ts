/**
 * Self-test for Phase 15 (Crunchbase brief enrichment). THIS IS THE
 * test:crunchbase gate. Pure + offline:
 *   A. crunchbaseToSources - maps an org into attributable, self-entailing
 *      passages (kind "crunchbase", crunchbase.com citation URL).
 *   B. fetchCrunchbaseSources - key-gated: [] (no network) without a key.
 *   C. Guard integration - Crunchbase counts as PRIMARY, but the citation guard
 *      is NOT weakened: crunchbase + an independent news source ⇒ "verified";
 *      crunchbase ALONE ⇒ "corroborated"; wiki alone ⇒ still REFUSED.
 * Run: npx tsx scripts/test-crunchbase.ts
 */
import {
  crunchbaseToSources,
  fetchCrunchbaseSources,
} from "@/lib/brief/source-crunchbase";
import { composeBrief, isPrimary } from "@/lib/brief/compose";
import type { CandidateClaim, FetchedSource } from "@/lib/brief/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const RECENT = new Date("2026-06-01T00:00:00Z");
const NOW = new Date("2026-06-17T00:00:00Z");

async function main(): Promise<void> {
  // =========================================================================
  // A. crunchbaseToSources (pure)
  // =========================================================================
  console.log("\ncrunchbase - org → attributable sources:");
  const sources = crunchbaseToSources(
    {
      name: "Acme AI",
      permalink: "acme-ai",
      shortDescription: "an enterprise AI automation platform.",
      fundingTotalUsd: 75_000_000,
      lastFundingType: "series_b",
      numEmployeesRange: "51-100",
    },
    RECENT,
  );
  check("emits 3 passages (overview + funding + headcount)", sources.length === 3);
  check("all are kind 'crunchbase'", sources.every((s) => s.kind === "crunchbase"));
  check("citation URL points at the crunchbase org page", sources.every((s) => s.url === "https://www.crunchbase.com/organization/acme-ai"));
  const funding = sources.find((s) => /raised/.test(s.text));
  check("funding passage formats the total ($75M) + round", !!funding && /\$75M/.test(funding.text) && /Series B/.test(funding.text));
  check("headcount passage carries the range", sources.some((s) => /51-100 employees/.test(s.text)));
  check("nothing emitted for absent fields", crunchbaseToSources({ name: "Empty Co" }, RECENT).length === 0);

  // =========================================================================
  // B. fetchCrunchbaseSources - key-gated
  // =========================================================================
  console.log("\ncrunchbase - key gate:");
  const prev = process.env.CRUNCHBASE_API_KEY;
  delete process.env.CRUNCHBASE_API_KEY;
  check("no key → [] (no network)", (await fetchCrunchbaseSources({ name: "Acme AI" })).length === 0);
  if (prev === undefined) delete process.env.CRUNCHBASE_API_KEY;
  else process.env.CRUNCHBASE_API_KEY = prev;

  // =========================================================================
  // C. Guard integration - primary, but the 2-source rule still holds
  // =========================================================================
  console.log("\ncrunchbase - primary, without weakening the guard:");
  check("isPrimary('crunchbase') is true", isPrimary("crunchbase") === true);
  check("isPrimary('wiki') is still false", isPrimary("wiki") === false);

  const cbFunding = funding!;
  const newsFunding: FetchedSource = {
    url: "https://techcrunch.com/2026/acme-series-b",
    title: "Acme AI raises Series B",
    kind: "news",
    text: "Acme AI has raised a total of $75M in funding to date, the company confirmed.",
    retrievedAt: RECENT,
  };
  const wikiFunding: FetchedSource = {
    url: "https://en.wikipedia.org/wiki/Acme_AI",
    title: "Acme AI",
    kind: "wiki",
    text: "Acme AI has raised a total of $75M in funding.",
    retrievedAt: RECENT,
  };
  const candidate: CandidateClaim = {
    text: "Acme AI has raised a total of $75M in funding.",
    category: "funding",
  };
  const company = { name: "Acme AI" };

  const both = composeBrief({ company, candidates: [candidate], sources: [cbFunding, newsFunding], now: NOW });
  check("crunchbase + independent news → verified", both.claims[0]?.status === "verified");
  check("verified claim cites a crunchbase source", (both.claims[0]?.sources ?? []).some((s) => s.kind === "crunchbase"));

  const alone = composeBrief({ company, candidates: [candidate], sources: [cbFunding], now: NOW });
  check("crunchbase alone (volatile) → corroborated, NOT verified", alone.claims[0]?.status === "corroborated");

  const wikiOnly = composeBrief({ company, candidates: [candidate], sources: [wikiFunding], now: NOW });
  check("wiki alone → still REFUSED (guard intact)", wikiOnly.claims.length === 0 && wikiOnly.refused.length === 1);

  console.log(`\ncrunchbase ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
