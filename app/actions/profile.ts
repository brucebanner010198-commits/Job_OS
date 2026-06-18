"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { addEntries, saveNote } from "@/lib/profile/service";
import { extractFromDictation } from "@/lib/profile/extract";
import { importResumeText } from "@/lib/import/import";
import { parseResumeDocument } from "@/lib/import/parse-document";
import { scheduleCareerRefresh } from "@/lib/career/trigger";

export interface SaveDictationResult {
  added: number;
  entries: { kind: string; title: string; sensitive: boolean }[];
}

/** Dictation/typed update → extracted, structured, merged into the profile. */
export async function saveDictationAction(
  rawText: string,
): Promise<SaveDictationResult> {
  await requireAccessForMutation();
  const text = rawText.trim();
  if (!text) return { added: 0, entries: [] };

  const { scope } = await getAppContext();
  const extracted = await extractFromDictation(text);

  // Keep the raw note (provenance), then merge the structured facts.
  await saveNote(scope, text, null, "dictation");
  await addEntries(
    scope,
    extracted.entries.map((e) => ({
      kind: e.kind,
      data: e.data,
      sensitive: e.sensitive,
      sourceNote: e.title,
    })),
  );

  const hasExperienceOrProject = extracted.entries.some(
    (e) => e.kind === "EXPERIENCE" || e.kind === "PROJECT",
  );
  if (hasExperienceOrProject) {
    after(() => {
      scheduleCareerRefresh(scope);
    });
  }

  revalidatePath("/master-resume");
  return {
    added: extracted.entries.length,
    entries: extracted.entries.map((e) => ({
      kind: e.kind,
      title: e.title,
      sensitive: e.sensitive,
    })),
  };
}

export interface ImportResult {
  added: number;
  kinds: string[];
  format?: "paste" | "pdf" | "docx";
}

/** Cold-start: paste a resume / LinkedIn text → structured profile entries. */
export async function importResumeAction(text: string): Promise<ImportResult> {
  await requireAccessForMutation();
  const trimmed = text.trim();
  if (!trimmed) return { added: 0, kinds: [] };
  const { scope } = await getAppContext();
  const res = await importResumeText(scope, trimmed);

  if (res.added > 0) {
    after(() => {
      scheduleCareerRefresh(scope);
    });
  }

  revalidatePath("/master-resume");
  revalidatePath("/setup");
  return { ...res, format: "paste" };
}

/** Upload PDF or DOCX resume → extract text → structured profile entries. */
export async function uploadResumeFileAction(
  formData: FormData,
): Promise<ImportResult> {
  await requireAccessForMutation();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("No file uploaded. Choose a PDF or Word (.docx) resume.");
  }

  const parsed = await parseResumeDocument(file);
  const { scope } = await getAppContext();
  const res = await importResumeText(scope, parsed.rawText);

  if (res.added > 0) {
    after(() => {
      scheduleCareerRefresh(scope);
    });
  }

  revalidatePath("/master-resume");
  revalidatePath("/setup");
  return { ...res, format: parsed.format };
}
