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
import { extractFromResume, splitResume } from "@/lib/profile/extract";
import { extractFromResumeHeuristic } from "./heuristic";
import { addEntries, saveNote } from "@/lib/profile/service";
import type { AppScope } from "@/lib/profiles/types";
import { ProfileEntryKind } from "@prisma/client";

/** Runtime set of valid enum values, used to validate LLM-provided kinds. */
const KIND_VALUES = new Set<string>(Object.values(ProfileEntryKind));

/** Narrow an arbitrary string to a ProfileEntryKind, or null if unknown. */
function toKind(kind: string): ProfileEntryKind | null {
  return KIND_VALUES.has(kind) ? (kind as ProfileEntryKind) : null;
}

type NewEntry = { kind: ProfileEntryKind; data: unknown; sourceNote?: string; sensitive?: boolean };

function toEntries(extracted: { kind: string; title?: string; data: unknown; sensitive?: boolean }[]): NewEntry[] {
  const out: NewEntry[] = [];
  for (const e of extracted) {
    const kind = toKind(e.kind);
    if (!kind) continue; // skip kinds the model invented
    out.push({ kind, data: e.data, sourceNote: e.title, sensitive: e.sensitive });
  }
  return out;
}

/** True when the resume is long enough to be extracted in several parts. */
export function isLongResume(text: string): boolean {
  return splitResume(text).length > 1;
}

/**
 * Import a resume: store the raw text as a note, then extract and save
 * entries part by part, so a long CV shows progress and a failure midway
 * keeps what was already extracted. Falls back to heuristic parsing only when
 * the local model is unreachable before anything was saved.
 */
export async function importResumeText(
  scope: AppScope,
  text: string,
): Promise<{ added: number; kinds: string[] }> {
  await saveNote(scope, text, null, "import");

  let added = 0;
  const kinds = new Set<string>();
  const save = async (entries: NewEntry[]) => {
    added += await addEntries(scope, entries);
    for (const e of entries) kinds.add(e.kind);
  };

  try {
    await extractFromResume(text, (part) => save(toEntries(part)));
  } catch (err) {
    if (added > 0) throw err;
    console.warn("AI resume extraction failed, using heuristic extraction fallback:", (err as Error).message);
    await save(toEntries(extractFromResumeHeuristic(splitResume(text).join("\n\n")).entries));
  }

  return { added, kinds: [...kinds] };
}
