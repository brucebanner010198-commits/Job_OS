/**
 * Wikidata SPARQL adapter (optional) - entity summary for company briefs.
 * Corroboration-only (kind: wiki). Never throws.
 */
import type { FetchedSource } from "@/lib/brief/types";
import { safeFetch } from "@/lib/brief/fetch-utils";

function escapeSparqlLiteral(str: string): string {
  return str.replace(/["\\{}\r\n\t]/g, " ").trim().slice(0, 100);
}

export async function fetchWikidataSources(
  company: { name: string; domain?: string },
): Promise<FetchedSource[]> {
  const safeName = escapeSparqlLiteral(company.name);
  if (!safeName) return [];

  const query = `
    SELECT ?item ?itemLabel ?description WHERE {
      ?item rdfs:label "${safeName}"@en .
      OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 3
  `;
  const url =
    "https://query.wikidata.org/sparql?format=json&query=" +
    encodeURIComponent(query);

  const raw = await safeFetch(url, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "JobOS/1.0" },
    timeoutMs: 12_000,
  });
  if (!raw) return [];

  try {
    const data = JSON.parse(raw) as {
      results?: { bindings?: Record<string, { value?: string }>[] };
    };
    const now = new Date();
    return (data.results?.bindings ?? []).map((b) => {
      const label = b.itemLabel?.value ?? company.name;
      const desc = b.description?.value ?? "";
      const itemUrl = b.item?.value ?? "";
      return {
        url: itemUrl || `https://www.wikidata.org/wiki/Special:Search?search=${encodeURIComponent(company.name)}`,
        title: `${label} - Wikidata`,
        kind: "wiki" as const,
        text: `${label}. ${desc}`.trim().slice(0, 3000),
        retrievedAt: now,
      };
    });
  } catch {
    return [];
  }
}
