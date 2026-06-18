/**
 * Pure metrics pipeline (Phase 9). Composes the compute brain over the
 * deterministic fixture corpus with NO DB - this is the offline preview the
 * /outcomes page falls back to when Postgres is unreachable or there is no
 * pipeline data yet, and the exact value the test gate checks.
 */
import { computeKpis } from "@/lib/metrics/compute";
import { fixtureMetricsInput, FIXTURE_NOW } from "@/lib/metrics/fixtures";
import type { MetricsInput, MetricsView } from "@/lib/metrics/types";

/** Run the compute brain over an explicit input (used by the service). */
export function processMetrics(input: MetricsInput, nowIso: string): MetricsView {
  return computeKpis(input, nowIso);
}

/**
 * The offline preview: the full dashboard computed from fixtures at a fixed NOW,
 * so it renders identically with or without a database.
 */
export function previewMetrics(): MetricsView {
  return computeKpis(fixtureMetricsInput, FIXTURE_NOW);
}
