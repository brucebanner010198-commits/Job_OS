import { z } from "zod";

/**
 * A cover letter draft is EXTRACTIVE: the model must tag which MasterProfile
 * entry ids it actually drew on (`usedFactIds`) so the provenance guard in
 * ./generate.ts can verify every cited fact is real and every metric is
 * grounded. `keyJdConcepts` are the genuine job-description themes the letter
 * mirrors - used to flag generic, could-be-anyone letters.
 */
export const coverLetterDraftSchema = z.object({
  /** The full cover letter body (3–4 short paragraphs, 250–400 words). */
  body: z.string().min(1),
  /** MasterProfile entry ids the letter is grounded in. */
  usedFactIds: z.array(z.string()),
  /** The strong impact opening line/hook (never "I saw your posting"). */
  openingHook: z.string().min(1),
  /** Real JD concepts the letter mirrors (no keyword stuffing). */
  keyJdConcepts: z.array(z.string()),
});

export type CoverLetterDraft = z.infer<typeof coverLetterDraftSchema>;
