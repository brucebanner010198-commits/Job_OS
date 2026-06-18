/**
 * Career-coach ProfileNotes - advisory fixes from rejection parsing and gap analysis.
 * Tagged via `source: "coach"` for Knowledge Notebook indexing.
 */
import "server-only";

import { db } from "@/lib/db";
import { formatCoachNoteBody } from "@/lib/coach/format";
import type { CoachNoteKind } from "@/lib/coach/format";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData } from "@/lib/profiles/scope";

export type { CoachNoteKind } from "@/lib/coach/format";
export { formatCoachNoteBody } from "@/lib/coach/format";

/** Persist an advisory coach note (never auto-applies profile changes). */
export async function storeCoachNote(
  scope: AppScope,
  opts: { kind: CoachNoteKind; title: string; body: string },
): Promise<void> {
  const full = formatCoachNoteBody(opts.kind, opts.title, opts.body);
  await db.profileNote.create({
    data: {
      ...scopeData(scope),
      rawText: full,
      cleanedText: full,
      source: "coach",
    },
  });
}
