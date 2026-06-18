/**
 * Jobicy source adapter - free remote jobs API.
 */
import type { RawJob, JobSource } from "@/lib/jobs/types";
import { getSecretSync } from "@/lib/secrets/sync";

interface JobicyJob {
  id?: number;
  companyName?: string;
  jobTitle?: string;
  jobGeo?: string;
  jobDescription?: string;
  url?: string;
  pubDate?: string;
  remote?: boolean;
}

interface JobicyResponse {
  jobs?: JobicyJob[];
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function mapJob(j: JobicyJob): RawJob {
  return {
    source: "jobicy",
    sourceId: j.id != null ? String(j.id) : undefined,
    url: j.url,
    company: j.companyName ?? "Unknown Company",
    title: j.jobTitle ?? "Unknown Title",
    location: j.jobGeo ?? "Remote",
    remote: j.remote ?? true,
    description: j.jobDescription ? stripTags(j.jobDescription) : "",
    postedAt: j.pubDate ? new Date(j.pubDate) : undefined,
  };
}

export const jobicySource: JobSource = {
  name: "jobicy",

  enabled(): boolean {
    return getSecretSync("JOBS_FREE_SOURCES") !== "0";
  },

  async fetch(query: string): Promise<RawJob[]> {
    try {
      const res = await fetch(
        `https://jobicy.com/api/v2/remote-jobs?count=50&geo=usa&industry=tech&tag=${encodeURIComponent(query)}`,
      );
      if (!res.ok) return [];
      const body = (await res.json()) as JobicyResponse;
      return (body.jobs ?? []).map(mapJob);
    } catch {
      return [];
    }
  },
};
