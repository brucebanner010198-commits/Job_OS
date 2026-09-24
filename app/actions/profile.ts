"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { addEntries, saveNote } from "@/lib/profile/service";
import { extractFromDictation } from "@/lib/profile/extract";
import { importResumeText, isLongResume } from "@/lib/import/import";
import { parseResumeDocument } from "@/lib/import/parse-document";
import { scheduleCareerRefresh } from "@/lib/career/trigger";
import { JobOSError } from "@/lib/errors/job-os-error";

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
  /** Long resumes finish in the background; entries appear as sections complete. */
  background?: boolean;
  format?: "paste" | "pdf" | "docx";
}

/** Cold-start: paste a resume / LinkedIn text → structured profile entries. */
export async function importResumeAction(text: string): Promise<ImportResult> {
  await requireAccessForMutation();
  const trimmed = text.trim();
  if (!trimmed) return { added: 0, kinds: [] };
  const { scope } = await getAppContext();
  if (isLongResume(trimmed)) {
    after(() => runBackgroundImport(scope, trimmed));
    return { added: 0, kinds: [], background: true, format: "paste" };
  }
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
    throw JobOSError.invalidArgument({
      domain: "job_os.import",
      reason: "NO_FILE_UPLOADED",
      location: "app/actions/profile.ts:uploadResumeFileAction",
      message: "No file uploaded. Choose a PDF or Word (.docx) resume.",
      remedy: "Select a file from your device before clicking upload.",
    });
  }

  const { scope } = await getAppContext();

  // Save the master resume binary locally
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), "storage", "master-resumes");
    await fs.mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const targetPath = path.join(dir, `${scope.userId}_${Date.now()}_${safeName}`);
    await fs.writeFile(targetPath, buffer);
  } catch (err) {
    console.warn("[uploadResumeFileAction] Local file backup warning:", err);
  }

  const parsed = await parseResumeDocument(file);
  if (isLongResume(parsed.rawText)) {
    after(() => runBackgroundImport(scope, parsed.rawText));
    return { added: 0, kinds: [], background: true, format: parsed.format };
  }
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

/** Runs after the response is sent; a local model needs minutes for a long CV. */
async function runBackgroundImport(scope: Parameters<typeof importResumeText>[0], text: string): Promise<void> {
  try {
    const res = await importResumeText(scope, text);
    if (res.added > 0) scheduleCareerRefresh(scope);
  } catch (err) {
    console.error("[import] background import stopped:", (err as Error).message);
  }
}
