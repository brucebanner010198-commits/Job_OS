import type { RawJob, JobSource } from "@/lib/jobs/types";

interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  location?: { name: string };
  updated_at?: string;
  content?: string;
}

interface AshbyJob {
  id: string;
  title: string;
  jobUrl: string;
  location?: string;
  department?: string;
  isRemote?: boolean;
}

interface LeverJob {
  id: string;
  text: string;
  hostedUrl: string;
  categories?: {
    location?: string;
    team?: string;
    commitment?: string;
  };
  workplaceType?: string;
  descriptionPlain?: string;
}

const GREENHOUSE_COMPANIES = ["figma", "stripe", "gitlab", "datadog", "dropbox", "linear", "retool", "brex"];
const ASHBY_COMPANIES = ["anthropic", "openai", "cursor", "ramp", "replit", "perplexity"];
const LEVER_COMPANIES = ["netflix", "atlassian", "spotify"];

/**
 * Direct ATS Portal Scanner:
 * Directly scrapes publicly accessible company career APIs (Greenhouse, Ashby, Lever)
 * without requiring any API keys, scraping middle-men, or paying third parties.
 */
export const atsPortalsSource: JobSource = {
  name: "ats-portals",
  enabled: () => true,

  async fetch(query: string): Promise<RawJob[]> {
    const qLower = query.toLowerCase();
    const jobs: RawJob[] = [];

    // 1. Fetch from Greenhouse public boards
    const ghPromises = GREENHOUSE_COMPANIES.map(async (company) => {
      try {
        const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`, {
          signal: AbortSignal.timeout(6000),
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        const rawList: GreenhouseJob[] = data.jobs || [];

        for (const j of rawList) {
          if (!qLower || j.title.toLowerCase().includes(qLower) || (j.content && j.content.toLowerCase().includes(qLower))) {
            jobs.push({
              source: "greenhouse-direct",
              sourceId: String(j.id),
              url: j.absolute_url,
              company: company.charAt(0).toUpperCase() + company.slice(1),
              title: j.title,
              location: j.location?.name ?? "Remote",
              remote: (j.location?.name ?? "").toLowerCase().includes("remote"),
              description: j.content || j.title,
              atsType: "greenhouse",
              postedAt: j.updated_at ? new Date(j.updated_at) : new Date(),
            });
          }
        }
      } catch {
        // Individual company fetch failure is non-blocking
      }
    });

    // 2. Fetch from Ashby public boards
    const ashbyPromises = ASHBY_COMPANIES.map(async (company) => {
      try {
        const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company}`, {
          signal: AbortSignal.timeout(6000),
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        const rawList: AshbyJob[] = data.jobs || [];

        for (const j of rawList) {
          if (!qLower || j.title.toLowerCase().includes(qLower)) {
            jobs.push({
              source: "ashby-direct",
              sourceId: j.id,
              url: j.jobUrl,
              company: company.charAt(0).toUpperCase() + company.slice(1),
              title: j.title,
              location: j.location ?? (j.isRemote ? "Remote" : "Hybrid"),
              remote: j.isRemote ?? true,
              description: `${j.title} at ${company}. Location: ${j.location || "Remote"}. Department: ${j.department || "Engineering"}`,
              atsType: "ashby",
            });
          }
        }
      } catch {
        // Individual company fetch failure is non-blocking
      }
    });

    // 3. Fetch from Lever public boards
    const leverPromises = LEVER_COMPANIES.map(async (company) => {
      try {
        const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, {
          signal: AbortSignal.timeout(6000),
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const rawList: LeverJob[] = await res.json();

        for (const j of rawList) {
          if (!qLower || j.text.toLowerCase().includes(qLower)) {
            jobs.push({
              source: "lever-direct",
              sourceId: j.id,
              url: j.hostedUrl,
              company: company.charAt(0).toUpperCase() + company.slice(1),
              title: j.text,
              location: j.categories?.location ?? "Remote",
              remote: j.workplaceType === "remote" || (j.categories?.location ?? "").toLowerCase().includes("remote"),
              description: j.descriptionPlain || j.text,
              atsType: "lever",
            });
          }
        }
      } catch {
        // Individual company fetch failure is non-blocking
      }
    });

    await Promise.allSettled([...ghPromises, ...ashbyPromises, ...leverPromises]);
    return jobs;
  },
};
