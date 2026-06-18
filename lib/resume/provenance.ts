import type { TailoredResume } from "./schema";
import { extractMetrics, isMetricGrounded } from "@/lib/util/metrics";

/**
 * Provenance guard (Hardening §B). A tailored resume is only usable if every
 * claim traces to a real MasterProfile entry and every metric it states is
 * actually present in the cited sources. This is what makes fabrication
 * structurally impossible rather than merely discouraged.
 */

export interface ProvenanceViolation {
  severity: "block" | "warn";
  location: string;
  message: string;
}

export interface ProvenanceReport {
  ok: boolean; // false if any "block" violation exists
  violations: ProvenanceViolation[];
}

export interface SourceEntry {
  id: string;
  /** flattened text of the entry (data + note) for grounding checks */
  text: string;
}

export function auditProvenance(
  resume: TailoredResume,
  sources: SourceEntry[],
): ProvenanceReport {
  // Pre-normalize each source's text (lowercase, commas stripped) for grounding.
  const byId = new Map(
    sources.map((s) => [s.id, s.text.toLowerCase().replace(/,/g, "")]),
  );
  const violations: ProvenanceViolation[] = [];

  const checkIds = (ids: string[], loc: string) => {
    for (const id of ids) {
      if (!byId.has(id)) {
        violations.push({
          severity: "block",
          location: loc,
          message: `cites unknown profile entry "${id}" - not in the master profile`,
        });
      }
    }
  };

  const checkMetrics = (text: string, ids: string[], loc: string) => {
    const metrics = extractMetrics(text);
    if (metrics.length === 0) return;
    const haystack = ids.map((id) => byId.get(id) ?? "").join("  ");
    for (const metric of metrics) {
      if (!isMetricGrounded(metric.core, haystack)) {
        violations.push({
          severity: "block",
          location: loc,
          message: `metric "${metric.raw}" is not present in the cited source(s) - possible fabrication`,
        });
      }
    }
  };

  if (resume.summary) {
    checkIds(resume.summary.sources, "summary");
    checkMetrics(resume.summary.text, resume.summary.sources, "summary");
  }

  resume.experience.forEach((exp, i) => {
    const base = `experience[${i}]`;
    checkIds(exp.sources, base);
    exp.bullets.forEach((b, j) => {
      const loc = `${base}.bullets[${j}]`;
      checkIds(b.sources, loc);
      // A bullet is grounded by its own + its parent role's sources.
      checkMetrics(b.text, [...b.sources, ...exp.sources], loc);
    });
  });

  resume.education.forEach((ed, i) => checkIds(ed.sources, `education[${i}]`));
  resume.skills.forEach((s, i) => checkIds(s.sources, `skills[${i}]`));

  return {
    ok: !violations.some((v) => v.severity === "block"),
    violations,
  };
}
