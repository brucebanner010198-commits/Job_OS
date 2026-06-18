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

/** Safe fetch with timeout - never throws. Rejects non-public http(s) URLs (SSRF). */
export async function safeFetch(
  url: string,
  opts?: { timeoutMs?: number; headers?: Record<string, string> },
): Promise<string | null> {
  if (!isPublicHttpUrl(url)) return null;

  const timeoutMs = opts?.timeoutMs ?? 12_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "JobOS-BriefBot/1.0 (+https://jobos.local)",
        Accept: "text/html,application/xhtml+xml,text/plain,application/json",
        ...opts?.headers,
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 50_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
