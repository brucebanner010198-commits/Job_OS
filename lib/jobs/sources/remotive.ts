/**
 * Remotive source adapter (plan §8 Phase 3) - free public remote-jobs API,
 * no key required. Strips HTML tags from the description field. Always returns
 * [] on any error; never throws into the pipeline.
 */

import type { RawJob, JobSource } from "@/lib/jobs/types";

/** Wire shape for a single entry in Remotive's `jobs[]` array. */
interface RemotiveJob {
  company_name?: string;
  title?: string;
  candidate_required_location?: string;
  description?: string;
  url?: string;
  publication_date?: string;
  id?: number;
}

interface RemotiveResponse {
  jobs?: RemotiveJob[];
}

/**
 * Strip HTML tags and decode common HTML entities from Remotive's HTML
 * description field, returning plain-text suitable for the pipeline.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function mapRemotiveJob(j: RemotiveJob): RawJob {
  return {
    source: "remotive",
    sourceId: j.id != null ? String(j.id) : undefined,
    url: j.url,
    company: j.company_name ?? "Unknown Company",
    title: j.title ?? "Unknown Title",
    location: j.candidate_required_location ?? "Remote",
    remote: true,
    description: j.description ? stripHtml(j.description) : "",
    postedAt: j.publication_date ? new Date(j.publication_date) : undefined,
  };
}

export const remotiveSource: JobSource = {
  name: "remotive",

  enabled(): boolean {
    return process.env.JOBS_FREE_SOURCES !== "0";
  },

  async fetch(query: string): Promise<RawJob[]> {
    try {
      const url =
        `https://remotive.com/api/remote-jobs` +
        `?search=${encodeURIComponent(query)}`;

      const response = await fetch(url);

      if (!response.ok) return [];

      const body = (await response.json()) as RemotiveResponse;
      if (!Array.isArray(body.jobs)) return [];

      return body.jobs.map(mapRemotiveJob);
    } catch {
      return [];
    }
  },
};
