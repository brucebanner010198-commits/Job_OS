/**
 * Read-only apply-route preview for job cards (before prepare).
 * Surfaces AUTONOMOUS / ASSISTED / MANUAL on the queue - counter to spray-and-pray tools.
 */
import { routeApplication } from "@/lib/apply/router";
import type { ApplyRoute } from "@/lib/apply/types";

export interface JobRoutePreviewInput {
  source: string;
  url?: string | null;
  atsType?: string | null;
}

/** Derive router surface key from job metadata (mirrors lib/apply/service.ts). */
export function deriveSurface(job: JobRoutePreviewInput): string {
  if (job.atsType) return job.atsType.toLowerCase().trim();

  const src = job.source.toLowerCase().trim();
  if (src.includes("linkedin")) return "linkedin";
  if (src.includes("dice")) return "dice";
  if (src.includes("wellfound")) return "wellfound";
  if (src.includes("workday")) return "workday";

  if (job.url) {
    try {
      const host = new URL(job.url).hostname.toLowerCase();
      if (host.includes("linkedin")) return "linkedin";
      if (host.includes("workday")) return "workday";
      if (host.includes("dice")) return "dice";
      if (host.includes("wellfound")) return "wellfound";
      if (host.includes("greenhouse")) return "greenhouse";
      if (host.includes("lever")) return "lever";
      if (host.includes("ashby")) return "ashby";
    } catch {
      // invalid URL - ignore
    }
  }

  return src;
}

/**
 * Preview route from job surface only - no fields/detection/knockout yet.
 * ASSISTED is the optimistic default for standard ATS; AUTONOMOUS only on tolerant surfaces.
 */
export function previewRouteFromJob(job: JobRoutePreviewInput): ApplyRoute {
  return routeApplication({
    surface: deriveSurface(job),
    fields: [],
    detection: { clean: true, signals: [] },
    knockouts: { disqualified: false, failures: [] },
    local: true,
  }).route;
}
