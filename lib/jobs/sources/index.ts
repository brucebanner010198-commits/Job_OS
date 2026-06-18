/**
 * Job-discovery source registry (plan §8 Phase 3).
 * SOURCES is the canonical ordered list of all adapters. `discover` runs all
 * enabled sources concurrently and merges their results. Always works offline
 * because fixturesSource is enabled by default (unless JOBS_USE_FIXTURES=0).
 */

import type { RawJob, JobSource } from "@/lib/jobs/types";
import { fixturesSource } from "./fixtures";
import { jsearchSource } from "./jsearch";
import { remotiveSource } from "./remotive";
import { remoteokSource } from "./remoteok";
import { arbeitnowSource } from "./arbeitnow";
import { jobicySource } from "./jobicy";

export const SOURCES: JobSource[] = [
  fixturesSource,
  jsearchSource,
  remotiveSource,
  remoteokSource,
  arbeitnowSource,
  jobicySource,
];

/** Sources that are currently configured and ready to run. */
export function enabledSources(): JobSource[] {
  return SOURCES.filter((s) => s.enabled());
}

/**
 * Run all enabled sources concurrently and flatten the results.
 * Rejected or erroring sources are silently skipped - the pipeline continues
 * with whatever partial results are available.
 */
export async function discover(query: string): Promise<RawJob[]> {
  const sources = enabledSources();
  const results = await Promise.allSettled(sources.map((s) => s.fetch(query)));

  const jobs: RawJob[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      jobs.push(...result.value);
    }
  }
  return jobs;
}
