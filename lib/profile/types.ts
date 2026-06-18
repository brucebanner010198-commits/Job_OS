/**
 * Shared master-profile fact shape. Compatible with the Prisma `ProfileEntry`
 * row but decoupled from it so generators (resume, cover letter, etc.) don't
 * depend on the DB layer.
 */
export interface ProfileFact {
  id: string;
  kind: string;
  data: unknown;
  sourceNote?: string | null;
  sensitive?: boolean | null;
}

/** Flatten a fact to searchable text (used for provenance grounding & prompts). */
export function flattenFact(fact: ProfileFact): string {
  const data =
    typeof fact.data === "string" ? fact.data : JSON.stringify(fact.data);
  return [data, fact.sourceNote ?? ""].filter(Boolean).join(" ");
}
