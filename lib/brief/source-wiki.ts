/**
 * Wikipedia source adapter - REST summary API (corroboration-only kind: "wiki").
 * Never throws; returns [] on any failure.
 */
import type { FetchedSource } from "@/lib/brief/types";
import { safeFetch } from "@/lib/brief/fetch-utils";

export async function fetchWikipassage(
  company: { name: string },
): Promise<FetchedSource[]> {
  const title = encodeURIComponent(company.name.replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
  const json = await safeFetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!json) return [];

  try {
    const data = JSON.parse(json) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    const text = data.extract?.trim();
    if (!text || text.length < 40) return [];
    const pageUrl =
      data.content_urls?.desktop?.page ??
      `https://en.wikipedia.org/wiki/${title}`;
    return [
      {
        url: pageUrl,
        title: `${data.title ?? company.name} - Wikipedia`,
        kind: "wiki",
        text: text.slice(0, 4000),
        retrievedAt: new Date(),
      },
    ];
  } catch {
    return [];
  }
}
