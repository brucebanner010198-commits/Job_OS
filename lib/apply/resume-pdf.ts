/**
 * Resolve the tailored resume PDF path for Playwright file upload (Phase 5).
 * Defaults to `.secrets/resume.pdf`; override with APPLY_RESUME_PDF.
 */
import { access } from "node:fs/promises";
import path from "node:path";
import { getSecret } from "@/lib/secrets";

const DEFAULT_PATH = path.join(process.cwd(), ".secrets", "resume.pdf");

/** Return an on-disk PDF path when configured and readable; otherwise undefined. */
export async function resolveResumePdfPath(): Promise<string | undefined> {
  const fromEnv = process.env.APPLY_RESUME_PDF ?? (await getSecret("APPLY_RESUME_PDF"));
  const candidate = (fromEnv?.trim() || DEFAULT_PATH).replace(/^~/, process.env.HOME ?? "");
  try {
    await access(candidate);
    return candidate;
  } catch {
    return undefined;
  }
}
