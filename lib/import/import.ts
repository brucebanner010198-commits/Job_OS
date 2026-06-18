/**
 * Cold-start import.
 *
 * Seeds the master profile from an existing resume so the user isn't staring
 * at an empty app. The resume is parsed into typed entries and the raw text is
 * kept as a ProfileNote for provenance.
 *
 * Binary PDF / DOCX parsing lives in `parse-document.ts`; callers extract plain
 * text upstream and feed it into `importResumeText`.
 */
import { extractFromResume } from "@/lib/profile/extract";
import { addEntries, saveNote } from "@/lib/profile/service";
import type { AppScope } from "@/lib/profiles/types";
import { ProfileEntryKind } from "@prisma/client";

/** Runtime set of valid enum values, used to validate LLM-provided kinds. */
const KIND_VALUES = new Set<string>(Object.values(ProfileEntryKind));

/** Narrow an arbitrary string to a ProfileEntryKind, or null if unknown. */
function toKind(kind: string): ProfileEntryKind | null {
  return KIND_VALUES.has(kind) ? (kind as ProfileEntryKind) : null;
}

/**
 * Import a pasted resume: parse it into entries, store the raw text as a note,
 * and persist the entries. Unknown/invalid kinds from the model are skipped.
 * Returns how many entries were added and which kinds they covered.
 */
export async function importResumeText(
  scope: AppScope,
  text: string,
): Promise<{ added: number; kinds: string[] }> {
  const extracted = await extractFromResume(text);

  await saveNote(scope, text, null, "import");

  const entries: {
    kind: ProfileEntryKind;
    data: unknown;
    sourceNote?: string;
    sensitive?: boolean;
  }[] = [];

  for (const e of extracted.entries) {
    const kind = toKind(e.kind);
    if (!kind) continue; // skip kinds the model invented
    entries.push({
      kind,
      data: e.data,
      sourceNote: e.title,
      sensitive: e.sensitive,
    });
  }

  const added = await addEntries(scope, entries);
  const kinds = Array.from(new Set(entries.map((e) => e.kind)));

  return { added, kinds };
}
