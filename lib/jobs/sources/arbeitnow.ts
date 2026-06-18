/**
 * Arbeitnow source adapter - free public jobs API (EU + remote focus).
 */
import type { RawJob, JobSource } from "@/lib/jobs/types";
import { getSecretSync } from "@/lib/secrets/sync";

interface ArbeitnowJob {
  slug?: string;
  company_name?: string;
  title?: string;
  location?: string;
  description?: string;
  url?: string;
  remote?: boolean;
  created_at?: number;
  tags?: string[];
}

interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
}

function mapJob(j: ArbeitnowJob): RawJob {
  return {
    source: "arbeitnow",
    sourceId: j.slug,
    url: j.url,
    company: j.company_name ?? "Unknown Company",
    title: j.title ?? "Unknown Title",
    location: j.location,
    remote: j.remote ?? false,
    description: j.description ?? "",
    postedAt: j.created_at ? new Date(j.created_at * 1000) : undefined,
  };
}

export const arbeitnowSource: JobSource = {
  name: "arbeitnow",

  enabled(): boolean {
    return getSecretSync("JOBS_FREE_SOURCES") !== "0";
  },

  async fetch(query: string): Promise<RawJob[]> {
    try {
      const url = `https://www.arbeitnow.com/api/job-board-api`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const body = (await res.json()) as ArbeitnowResponse;
      const jobs = (body.data ?? []).map(mapJob);
      const q = query.toLowerCase();
      if (!q) return jobs.slice(0, 50);
      return jobs
        .filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.description.toLowerCase().includes(q),
        )
        .slice(0, 50);
    } catch {
      return [];
    }
  },
};
