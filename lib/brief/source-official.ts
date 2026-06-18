/**
 * Official-site source adapter - fetches the company domain /about page.
 * Never throws; returns [] on any failure.
 */
import type { FetchedSource } from "@/lib/brief/types";
import { safeFetch, stripHtml } from "@/lib/brief/fetch-utils";

function normalizeDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function fetchOfficialSite(
  company: { name: string; domain?: string },
): Promise<FetchedSource[]> {
  if (!company.domain?.trim()) return [];
  const domain = normalizeDomain(company.domain.trim());
  const now = new Date();
  const paths = ["/about", "/about-us", "/company", ""];
  const out: FetchedSource[] = [];

  for (const path of paths) {
    const url = `https://${domain}${path}`;
    const html = await safeFetch(url);
    if (!html) continue;
    const text = stripHtml(html);
    if (text.length < 120) continue;
    out.push({
      url,
      title: `${company.name} - official site`,
      kind: "official",
      text: text.slice(0, 4000),
      retrievedAt: now,
    });
    if (out.length >= 2) break;
  }

  return out;
}
