/**
 * SEC EDGAR Form D adapter - US private funding filings. Free; requires
 * SEC_EDGAR_USER_AGENT (name + email). Never throws.
 */
import type { FetchedSource } from "@/lib/brief/types";
import { safeFetch } from "@/lib/brief/fetch-utils";
import { getSecretSync } from "@/lib/secrets/sync";

interface EdgarHit {
  _source?: {
    entity_name?: string;
    offering_amount?: string;
    filed_at?: string;
  };
}

export async function fetchEdgarSources(
  company: { name: string; domain?: string },
): Promise<FetchedSource[]> {
  const ua = getSecretSync("SEC_EDGAR_USER_AGENT");
  if (!ua) return [];

  const q = encodeURIComponent(company.name);
  const url = `https://efts.sec.gov/LATEST/search-index?q=${q}&dateRange=custom&startdt=2018-01-01&forms=D`;
  const raw = await safeFetch(url, {
    headers: { "User-Agent": ua, Accept: "application/json" },
    timeoutMs: 15_000,
  });
  if (!raw) return [];

  try {
    const data = JSON.parse(raw) as { hits?: { hits?: EdgarHit[] } };
    const hits = data.hits?.hits ?? [];
    const now = new Date();
    const out: FetchedSource[] = [];

    for (const hit of hits.slice(0, 3)) {
      const src = hit._source;
      if (!src?.entity_name) continue;
      const amount = src.offering_amount ?? "undisclosed";
      const filed = src.filed_at ?? "unknown date";
      out.push({
        url: `https://www.sec.gov/edgar/search/#/q=${q}`,
        title: `SEC Form D - ${src.entity_name}`,
        kind: "news",
        text:
          `${src.entity_name} filed SEC Form D on ${filed}. ` +
          `Reported offering amount: ${amount}. ` +
          `Source: SEC EDGAR full-text search for "${company.name}".`,
        retrievedAt: now,
      });
    }
    return out;
  } catch {
    return [];
  }
}
