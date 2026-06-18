import type { ProfileFact } from "@/lib/profile/types";
import { flattenFact } from "@/lib/profile/types";
import {
  extractMetrics,
  groundingHaystack,
  isMetricGrounded,
} from "@/lib/util/metrics";
import type {
  ProvenanceReport,
  ProvenanceViolation,
  SourceEntry,
} from "@/lib/resume/provenance";

export type { ProvenanceReport, ProvenanceViolation, SourceEntry };

/** Build source entries from profile facts for grounding checks. */
export function factsToSources(facts: ProfileFact[]): SourceEntry[] {
  return facts.map((f) => ({ id: f.id, text: flattenFact(f) }));
}

export interface CoverLetterProvenanceInput {
  body: string;
  usedFactIds: string[];
  /** Non-sensitive facts the model was given - only these ids are valid citations. */
  allowedFacts: ProfileFact[];
}

/**
 * Provenance guard for cover letters - mirrors resume auditProvenance patterns.
 * Every cited fact id must exist in allowedFacts; every metric must trace to cited sources.
 */
export function auditCoverLetterProvenance(
  input: CoverLetterProvenanceInput,
): ProvenanceReport {
  const allowedIds = new Set(input.allowedFacts.map((f) => f.id));
  const byId = new Map(
    input.allowedFacts.map((f) => [
      f.id,
      flattenFact(f).toLowerCase().replace(/,/g, ""),
    ]),
  );
  const violations: ProvenanceViolation[] = [];

  for (const id of input.usedFactIds) {
    if (!allowedIds.has(id)) {
      violations.push({
        severity: "block",
        location: "body",
        message: `cites unknown profile entry "${id}" - not in the master profile`,
      });
    }
  }

  const citedHaystack = groundingHaystack(
    input.usedFactIds.map((id) => byId.get(id) ?? ""),
  );
  for (const metric of extractMetrics(input.body)) {
    if (!isMetricGrounded(metric.core, citedHaystack)) {
      violations.push({
        severity: "block",
        location: "body",
        message: `metric "${metric.raw}" is not present in the cited source(s) - possible fabrication`,
      });
    }
  }

  return {
    ok: !violations.some((v) => v.severity === "block"),
    violations,
  };
}

/** Flatten provenance violations into the legacy string format used by generate.ts. */
export function provenanceViolationsToStrings(
  report: ProvenanceReport,
): string[] {
  return report.violations.map(
    (v) => `${v.severity === "block" ? "block" : "warn"}: ${v.message}`,
  );
}
