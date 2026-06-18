/**
 * Live Gmail adapter (Phase 6) - the real network-backed GmailSource. Reads the
 * Gmail REST API over fetch with an OAuth access token and maps each message
 * payload into the Prisma-free RawEmail shape the brain reasons over.
 *
 * Mirrors the JSearch pattern: NEVER throws to callers - any auth/network error
 * yields [] (or undefined for the watermark), so the tracker silently falls
 * back rather than crashing. The `.ics` invite is read from the actual
 * `text/calendar` MIME part, not guessed from the body (plan §8d).
 */

import type { GmailListOptions, GmailSource } from "@/lib/gmail/types";
import type { RawEmail } from "@/lib/track/types";
import { getAccessToken } from "@/lib/gmail/oauth";
import { readTokens } from "@/lib/gmail/token-store";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// A job-biased default query. Excludes promotions to cut the newsletter flood;
// the classifier is the real filter, this just narrows the fetch.
const DEFAULT_QUERY =
  '{interview "thank you for applying" "your application" recruiter offer ' +
  'assessment "next steps" "we received your application"} -category:promotions';

interface GmailHeader {
  name: string;
  value: string;
}
interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  threadId: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
}

export function liveGmailSource(profileId?: string): GmailSource {
  return {
    id: "live",
    isLive: true,

    async listJobEmails(opts?: GmailListOptions): Promise<RawEmail[]> {
      const token = await getAccessToken(profileId);
      if (!token) return [];

      const sinceDays = opts?.sinceDays ?? 90;
      const max = Math.min(opts?.max ?? 50, 100);
      const q = `${opts?.query ?? DEFAULT_QUERY} newer_than:${sinceDays}d`;

      try {
        const list = await gmailFetch<{ messages?: { id: string }[] }>(
          token,
          `/messages?q=${encodeURIComponent(q)}&maxResults=${max}`,
        );
        const ids = (list.messages ?? []).map((m) => m.id);
        const emails = await Promise.all(ids.map((id) => fetchMessage(token, id)));
        return emails
          .filter((e): e is RawEmail => e !== undefined)
          .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
      } catch {
        return [];
      }
    },

    async currentHistoryId(): Promise<string | undefined> {
      const token = await getAccessToken(profileId);
      if (!token) return undefined;
      try {
        const p = await gmailFetch<{ historyId?: string }>(token, "/profile");
        return p.historyId;
      } catch {
        return undefined;
      }
    },
  };
}

/** The connected address (for display), or undefined. */
export async function liveEmailAddress(profileId?: string): Promise<string | undefined> {
  return (await readTokens(profileId))?.emailAddress;
}

async function gmailFetch<T>(token: string, p: string): Promise<T> {
  const res = await fetch(`${API}${p}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}`);
  return (await res.json()) as T;
}

function header(headers: GmailHeader[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function decodeB64Url(data: string | undefined): string {
  if (!data) return "";
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

function findPart(
  part: GmailPart | undefined,
  predicate: (p: GmailPart) => boolean,
): GmailPart | undefined {
  if (!part) return undefined;
  if (predicate(part)) return part;
  for (const child of part.parts ?? []) {
    const found = findPart(child, predicate);
    if (found) return found;
  }
  return undefined;
}

function parseFrom(from: string): { email: string; name?: string; domain?: string } {
  const m = from.match(/<([^>]+)>/);
  const email = (m ? m[1] : from).trim().toLowerCase();
  const name = m ? from.replace(/<[^>]+>/, "").replace(/"/g, "").trim() : undefined;
  const domain = email.includes("@") ? email.split("@")[1] : undefined;
  return { email, name: name || undefined, domain };
}

async function fetchMessage(token: string, id: string): Promise<RawEmail | undefined> {
  try {
    const msg = await gmailFetch<GmailMessage>(token, `/messages/${id}?format=full`);
    const headers = msg.payload?.headers;
    const from = header(headers, "From") ?? "";
    const { email, name, domain } = parseFrom(from);

    const references = [
      ...(header(headers, "References")?.split(/\s+/) ?? []),
      ...(header(headers, "In-Reply-To")?.split(/\s+/) ?? []),
    ].filter(Boolean);

    const icsPart = findPart(
      msg.payload,
      (p) => (p.mimeType ?? "").toLowerCase() === "text/calendar",
    );
    const textPart = findPart(
      msg.payload,
      (p) => (p.mimeType ?? "").toLowerCase() === "text/plain",
    );

    const receivedAt = msg.internalDate
      ? new Date(Number(msg.internalDate)).toISOString()
      : new Date().toISOString();

    return {
      gmailMessageId: msg.id,
      gmailThreadId: msg.threadId,
      rfcMessageId: header(headers, "Message-ID") ?? header(headers, "Message-Id"),
      references,
      from,
      fromEmail: email,
      fromName: name,
      fromDomain: domain,
      to: (header(headers, "To") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      subject: header(headers, "Subject") ?? "(no subject)",
      snippet: msg.snippet,
      bodyText: decodeB64Url(textPart?.body?.data) || undefined,
      receivedAt,
      labelIds: msg.labelIds ?? [],
      listUnsubscribe: Boolean(header(headers, "List-Unsubscribe")),
      icsRaw: icsPart ? decodeB64Url(icsPart.body?.data) || undefined : undefined,
    };
  } catch {
    return undefined;
  }
}
