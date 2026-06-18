/**
 * JSearch source adapter (plan §8 Phase 3) - paid PAYG spine via RapidAPI.
 * Disabled when JSEARCH_API_KEY is absent. Always returns [] on any error;
 * never throws into the pipeline.
 */

import type { RawJob, JobSource } from "@/lib/jobs/types";
import { getSecret } from "@/lib/secrets";
import { getSecretSync } from "@/lib/secrets/sync";

/** Wire shape of a single entry in JSearch's `data[]` array. */
interface JSearchJob {
  employer_name?: string;
  job_title?: string;
  job_city?: string;
  job_country?: string;
  job_is_remote?: boolean;
  job_description?: string;
  job_apply_link?: string;
  job_min_salary?: number;
  job_max_salary?: number;
  /** Unix timestamp (seconds). */
  job_posted_at_timestamp?: number;
  job_id?: string;
}

interface JSearchResponse {
  data?: JSearchJob[];
}

function mapJSearchJob(j: JSearchJob): RawJob {
  const parts = [j.job_city, j.job_country].filter(Boolean);
  return {
    source: "jsearch",
    sourceId: j.job_id,
    url: j.job_apply_link,
    company: j.employer_name ?? "Unknown Company",
    title: j.job_title ?? "Unknown Title",
    location: parts.length > 0 ? parts.join(", ") : undefined,
    remote: j.job_is_remote ?? false,
    description: j.job_description ?? "",
    salaryMin: j.job_min_salary,
    salaryMax: j.job_max_salary,
    postedAt:
      j.job_posted_at_timestamp != null
        ? new Date(j.job_posted_at_timestamp * 1000)
        : undefined,
  };
}

export const jsearchSource: JobSource = {
  name: "jsearch",

  enabled(): boolean {
    return Boolean(getSecretSync("JSEARCH_API_KEY"));
  },

  async fetch(query: string): Promise<RawJob[]> {
    const apiKey = await getSecret("JSEARCH_API_KEY");
    if (!apiKey) return [];

    try {
      const url =
        `https://jsearch.p.rapidapi.com/search` +
        `?query=${encodeURIComponent(query)}&num_pages=1`;

      const response = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
        },
      });

      if (!response.ok) return [];

      const body = (await response.json()) as JSearchResponse;
      if (!Array.isArray(body.data)) return [];

      return body.data.map(mapJSearchJob);
    } catch {
      return [];
    }
  },
};
