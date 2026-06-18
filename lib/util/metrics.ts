/**
 * Metric extraction + boundary-aware grounding. Shared by the resume and
 * cover-letter provenance guards so fabrication can't slip through one path.
 *
 * A "metric" is a number that reads like an impressive claim - it carries a
 * $/% symbol or a unit word, or has magnitude ≥ 100. Those are exactly the
 * values an LLM tends to invent, so each must trace to a cited source.
 *
 * Grounding is BOUNDARY-AWARE: the number must appear as a standalone value in
 * the source, so a fabricated "150" no longer matches inside a real "21500",
 * and "40" no longer matches inside a date like "2014".
 */
export interface Metric {
  raw: string;
  /** digits only, commas stripped - the value we require in the sources */
  core: string;
}

const METRIC_RE =
  /(\$\s?)?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(%|k\b|m\b|bn\b|x\b|\+|hrs?\b|hours?\b|years?\b|yrs?\b|months?\b|users?\b|customers?\b|clients?\b|people\b|projects?\b|reports?\b|engineers?\b|members?\b|countries\b|languages?\b)?/gi;

export function extractMetrics(text: string): Metric[] {
  const out: Metric[] = [];
  for (const m of text.matchAll(METRIC_RE)) {
    const dollar = m[1];
    const num = m[2];
    const unit = m[3];
    const value = parseFloat(num.replace(/,/g, ""));
    const isMetric = Boolean(dollar) || Boolean(unit) || value >= 100;
    if (!isMetric) continue;
    out.push({ raw: m[0].trim(), core: num.replace(/,/g, "") });
  }
  return out;
}

/** Normalize source text for grounding: lowercase, commas stripped. */
export function groundingHaystack(texts: string[]): string {
  return texts.join("  ").toLowerCase().replace(/,/g, "");
}

/**
 * True if `core` appears as a STANDALONE number in an already-normalized
 * haystack (see groundingHaystack) - not as a substring of a larger number.
 */
export function isMetricGrounded(core: string, normalizedHaystack: string): boolean {
  const esc = core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\d.,])${esc}(?![\\d.,])`).test(normalizedHaystack);
}
