/**
 * Data-minimization layer (Hardening §E).
 *
 * The master profile may contain "life facts" that are health/family/
 * protected-class data. Those must be redacted or withheld before any text is
 * sent to an LLM (even with ZDR on). This module is the single choke point.
 */
import type { ProfileEntry } from "@prisma/client";

/** Drop entries flagged sensitive; keep everything safe to reason over. */
export function nonSensitive(entries: ProfileEntry[]): ProfileEntry[] {
  return entries.filter((e) => !e.sensitive);
}

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "[EMAIL]", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  { label: "[PHONE]", re: /(?:\+?\d[\s-]?){7,15}\d/g },
  { label: "[SSN]", re: /\b\d{3}-\d{2}-\d{4}\b/g },
];

/**
 * Scrub direct identifiers from free text before it leaves the machine.
 * Used for any text that does not *need* contact details to be reasoned over
 * (e.g. dictation transcripts for fact extraction).
 */
export function scrubPII(text: string): string {
  let out = text;
  for (const { label, re } of PATTERNS) out = out.replace(re, label);
  return out;
}
