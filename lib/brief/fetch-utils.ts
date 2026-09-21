import { isPublicHttpUrl } from "@/lib/security/url";

/**
 * Strip HTML tags and collapse whitespace for source text extraction.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Safe fetch with timeout - never throws. Rejects non-public http(s) URLs (SSRF) and validates redirects. */
export async function safeFetch(
  url: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<string | null> {
  let currentUrl = url;
  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop < 4; hop++) {
      if (!isPublicHttpUrl(currentUrl)) return null;

      const res = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "JobOS-BriefBot/1.0 (+https://jobos.local)",
          Accept: "text/html,application/xhtml+xml,text/plain,application/json",
          ...opts?.headers,
        },
        next: { revalidate: 0 },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return null;
        try {
          const nextTarget = new URL(location, currentUrl).href;
          currentUrl = nextTarget;
          continue;
        } catch {
          return null;
        }
      }

      if (!res.ok) return null;
      const text = await res.text();
      return text.slice(0, 50_000);
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
