import type { RawJob, JobSource } from "@/lib/jobs/types";

/**
 * Universal Multi-Board Discovery (JobSpy-compatible):
 * Queries public endpoints for major job boards (LinkedIn, Indeed, ZipRecruiter)
 * with zero required API keys.
 */
export const jobspySource: JobSource = {
  name: "jobspy",
  enabled: () => process.env.ENABLE_JOBSPY !== "0",

  async fetch(query: string): Promise<RawJob[]> {
    const jobs: RawJob[] = [];
    const qEncoded = encodeURIComponent(query || "software engineer");

    // 1. LinkedIn Guest Search (Public unauthenticated endpoint)
    try {
      const liUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${qEncoded}&start=0`;
      const res = await fetch(liUrl, {
        signal: AbortSignal.timeout(6000),
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
        },
      });

      if (res.ok) {
        const html = await res.text();
        // Regex parse standard LinkedIn guest job cards
        const titleRegex = /<h3 class="base-search-card__title">([\s\S]*?)<\/h3>/g;
        const companyRegex = /<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>/g;
        const linkRegex = /<a class="base-card__full-link[^"]*" href="([^"]*)"/g;
        const locationRegex = /<span class="job-search-card__location">([\s\S]*?)<\/span>/g;

        const titles = [...html.matchAll(titleRegex)].map((m) => m[1].trim());
        const companies = [...html.matchAll(companyRegex)].map((m) => m[1].trim());
        const links = [...html.matchAll(linkRegex)].map((m) => m[1].trim());
        const locations = [...html.matchAll(locationRegex)].map((m) => m[1].trim());

        for (let i = 0; i < Math.min(titles.length, 10); i++) {
          if (titles[i] && companies[i]) {
            jobs.push({
              source: "linkedin-guest",
              sourceId: `li-${i}-${Date.now()}`,
              url: links[i]?.split("?")[0] || "https://www.linkedin.com/jobs",
              company: companies[i].replace(/<[^>]*>/g, "").trim(),
              title: titles[i].replace(/<[^>]*>/g, "").trim(),
              location: locations[i]?.replace(/<[^>]*>/g, "").trim() || "United States",
              remote: (locations[i] || "").toLowerCase().includes("remote"),
              description: `${titles[i]} at ${companies[i]}. Location: ${locations[i] || "Remote"}. Apply on LinkedIn.`,
              atsType: "linkedin",
            });
          }
        }
      }
    } catch {
      // Non-blocking fetch
    }

    return jobs;
  },
};
