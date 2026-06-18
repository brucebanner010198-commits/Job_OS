/**
 * RemoteOK source adapter - free public jobs API. No key required.
 */
import type { RawJob, JobSource } from "@/lib/jobs/types";
import { getSecretSync } from "@/lib/secrets/sync";

interface RemoteOkJob {
  id?: string;
  company?: string;
  position?: string;
  location?: string;
  description?: string;
  url?: string;
  date?: string;
  tags?: string[];
}

function mapJob(j: RemoteOkJob): RawJob {
  return {
    source: "remoteok",
    sourceId: j.id,
    url: j.url,
    company: j.company ?? "Unknown Company",
    title: j.position ?? "Unknown Title",
    location: j.location ?? "Remote",
    remote: true,
    description: j.description ?? "",
    postedAt: j.date ? new Date(j.date) : undefined,
  };
}

export const remoteokSource: JobSource = {
  name: "remoteok",

  enabled(): boolean {
    return getSecretSync("JOBS_FREE_SOURCES") !== "0";
  },

  async fetch(query: string): Promise<RawJob[]> {
    try {
      const res = await fetch("https://remoteok.com/api");
      if (!res.ok) return [];
      const body = (await res.json()) as RemoteOkJob[];
      if (!Array.isArray(body)) return [];
      const q = query.toLowerCase();
      const jobs = body
        .filter((j) => j.position && j.company)
        .map(mapJob);
      if (!q) return jobs.slice(0, 50);
      return jobs
        .filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.description.toLowerCase().includes(q) ||
            j.company.toLowerCase().includes(q),
        )
        .slice(0, 50);
    } catch {
      return [];
    }
  },
};
