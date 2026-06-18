/**
 * Web-research brief adapter - seeds company URLs, fetches via fetch-utils,
 * optionally queries SearXNG. Returns quoted passages with URLs for the
 * citation guard. Never throws; never scrapes gated sites.
 */
import type { FetchedSource } from "@/lib/brief/types";
import { safeFetch, stripHtml } from "@/lib/brief/fetch-utils";
import { getSecretSync } from "@/lib/secrets/sync";

function domainFromCompany(company: { name: string; domain?: string }): string | undefined {
  if (company.domain?.trim()) {
    return company.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  const slug = company.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!slug) return undefined;
  return `${slug}.com`;
}

async function searxngSearch(query: string): Promise<FetchedSource[]> {
  const base = getSecretSync("SEARXNG_URL");
  if (!base) return [];
  const url = `${base.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}&format=json`;
  const raw = await safeFetch(url, {
    headers: { Accept: "application/json" },
    timeoutMs: 10_000,
  });
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as { results?: { url?: string; title?: string; content?: string }[] };
    const now = new Date();
    return (data.results ?? [])
      .filter((r) => r.url && r.content && !r.url.includes("crunchbase.com"))
      .slice(0, 5)
      .map((r) => ({
        url: r.url!,
        title: r.title ?? "Web result",
        kind: "news" as const,
        text: r.content!.slice(0, 3000),
        retrievedAt: now,
      }));
  } catch {
    return [];
  }
}

/** Fetch public pages about a company for brief grounding. */
export async function fetchWebResearchSources(
  company: { name: string; domain?: string },
): Promise<FetchedSource[]> {
  const now = new Date();
  const domain = domainFromCompany(company);
  const seeds: string[] = [];
  if (domain) {
    seeds.push(
      `https://${domain}/about`,
      `https://${domain}/about-us`,
      `https://${domain}/careers`,
      `https://${domain}/`,
    );
  }
  seeds.push(
    `https://en.wikipedia.org/wiki/${encodeURIComponent(company.name.replace(/ /g, "_"))}`,
  );

  const out: FetchedSource[] = [];
  for (const url of seeds) {
    const html = await safeFetch(url);
    if (!html) continue;
    const text = stripHtml(html);
    if (text.length < 150) continue;
    const kind = url.includes("wikipedia.org") ? ("wiki" as const) : ("official" as const);
    out.push({
      url,
      title: `${company.name} - web research`,
      kind,
      text: text.slice(0, 4000),
      retrievedAt: now,
    });
    if (out.length >= 3) break;
  }

  const news = await searxngSearch(`${company.name} company news funding`);
  return [...out, ...news];
}
