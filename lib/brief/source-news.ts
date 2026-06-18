/**
 * News source adapter - Google News RSS search for recent company coverage.
 * Never throws; returns [] on any failure.
 */
import type { FetchedSource } from "@/lib/brief/types";
import { safeFetch, stripHtml } from "@/lib/brief/fetch-utils";

function parseRssItems(xml: string): { title: string; link: string; description: string }[] {
  const items: { title: string; link: string; description: string }[] = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml)) !== null) {
    const block = match[1]!;
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? "";
    const desc =
      block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ?? "";
    if (title && link) items.push({ title, link, description: stripHtml(desc) });
  }
  return items;
}

export async function fetchNewsArticles(
  company: { name: string },
): Promise<FetchedSource[]> {
  const q = encodeURIComponent(`"${company.name}"`);
  const url = `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
  const xml = await safeFetch(url, { timeoutMs: 15_000 });
  if (!xml) return [];

  const now = new Date();
  return parseRssItems(xml)
    .slice(0, 5)
    .filter((item) => item.description.length > 40)
    .map((item) => ({
      url: item.link,
      title: item.title,
      kind: "news" as const,
      text: item.description.slice(0, 3000),
      retrievedAt: now,
    }));
}
