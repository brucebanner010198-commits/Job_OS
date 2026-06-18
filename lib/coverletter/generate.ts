import { chatJson } from "@/lib/ai/openrouter";
import { type ProfileFact, flattenFact } from "@/lib/profile/types";
import { coverLetterDraftSchema, type CoverLetterDraft } from "./schema";
import {
  auditCoverLetterProvenance,
  provenanceViolationsToStrings,
} from "./provenance";
import {
  countWords,
  F500_STRUCTURE_TEMPLATE,
  mentionsCompany,
  validateCoverLetterStandards,
  type CoverLetterStandardsReport,
  COVER_LETTER_WORD_COUNT_MIN,
  COVER_LETTER_WORD_COUNT_MAX,
} from "./standards";

/**
 * Cover letter generator (provenance-guarded). Like the resume tailor, this is
 * EXTRACTIVE: the model may only use facts we hand it, must tag which fact ids
 * it used, and any number that reads like a metric must trace back to a cited
 * fact. A cover letter is never auto-sent - `requiresHumanEdit` is always true.
 */

export interface CoverLetterInput {
  facts: ProfileFact[];
  jobTitle: string;
  company: string;
  jobDescription: string;
  contactName: string;
}

export interface CoverLetterResult {
  body: string;
  wordCount: number;
  /** true when there are no "block" violations - safe to surface for editing */
  provenanceOk: boolean;
  violations: string[];
  /** true when the letter reads as generic / could-be-anyone */
  genericnessFlag: boolean;
  /** Fortune 500 / ATS standards checklist */
  standards: CoverLetterStandardsReport;
  /** always true: a human must review before this letter is sent */
  requiresHumanEdit: true;
}

const SYSTEM = `You are an expert cover letter writer who is FORBIDDEN from inventing anything.

Hard rules:
- EXTRACTIVE ONLY. You may only use facts present in the provided MASTER PROFILE entries. Never invent or infer an employer, title, date, metric, skill, example, or achievement that is not in those entries.
- Track which entries you actually used and return their exact ids in "usedFactIds". Only use ids that appear in the MASTER PROFILE.
- Every NUMBER/METRIC you write (%, $, counts, multipliers, magnitudes) must appear verbatim in one of the facts you cite. If a quantity is not in the facts, do not state it.
- Use the SAME employers, titles, dates, and metrics as the profile - this letter must stay aligned with the tailored resume (no contradictions).

Fortune 500 / big-tech structure (${COVER_LETTER_WORD_COUNT_MIN}–${COVER_LETTER_WORD_COUNT_MAX} words, plain text for ATS):
${F500_STRUCTURE_TEMPLATE}

Style (what recruiters at Microsoft, Google, Amazon, and Fortune 500 companies expect):
- Skimmable: 3–4 short paragraphs, no tables, no markdown, no bullet glyphs, no HTML.
- Specificity beats passion: name the company and role; mirror real JD concepts where they genuinely match experience. NEVER use empty phrases like "passion for", "leader in innovation", "great team player", or "dream company".
- Show, don't tell: lead with a measurable result from the profile, not "I am writing to apply" or "I saw your posting". Put this opening line in "openingHook".
- One paragraph must address the employer's SPECIFIC need from the job description, supported ONLY by real facts (list those fact ids in "usedFactIds").
- End with a clear, confident call to action - availability or next step, not "I look forward to hearing from you at your earliest convenience."
- List genuine JD themes you mirrored in "keyJdConcepts" (no keyword stuffing).

Return ONLY a JSON object matching the required schema.`;

/** Render the id-tagged facts for the prompt: \`[id] (kind) <flattened text>\`. */
function factListing(facts: ProfileFact[]): string {
  return facts.map((f) => `[${f.id}] (${f.kind}) ${flattenFact(f)}`).join("\n");
}

export async function generateCoverLetter(
  input: CoverLetterInput,
): Promise<CoverLetterResult> {
  // Sensitive facts never reach the model.
  const facts = input.facts.filter((f) => !f.sensitive);

  const user = `MASTER PROFILE (id-tagged - cite the ids you use in "usedFactIds"):
${factListing(facts)}

TARGET ROLE: ${input.jobTitle} at ${input.company}
ADDRESSED TO: ${input.contactName}

JOB DESCRIPTION:
${input.jobDescription}

Write the cover letter now, grounded ONLY in the facts above. Follow the hook → fit → proof → close structure.`;

  const { value: draft }: { value: CoverLetterDraft } = await chatJson(
    coverLetterDraftSchema,
    {
      task: "coverLetter",
      temperature: 0.4,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
    },
  );

  const provenance = auditCoverLetterProvenance({
    body: draft.body,
    usedFactIds: draft.usedFactIds,
    allowedFacts: facts,
  });

  const violations: string[] = [...provenanceViolationsToStrings(provenance)];

  const wordCount = countWords(draft.body);
  if (wordCount < COVER_LETTER_WORD_COUNT_MIN || wordCount > COVER_LETTER_WORD_COUNT_MAX) {
    violations.push(
      `warn: word count ${wordCount} is outside the ${COVER_LETTER_WORD_COUNT_MIN}–${COVER_LETTER_WORD_COUNT_MAX} word target`,
    );
  }

  const genericnessFlag =
    !mentionsCompany(draft.body, input.company) ||
    draft.keyJdConcepts.length < 1;

  const provenanceOk = provenance.ok;

  const standards = validateCoverLetterStandards({
    body: draft.body,
    company: input.company,
    jobTitle: input.jobTitle,
    wordCount,
    openingHook: draft.openingHook,
    keyJdConcepts: draft.keyJdConcepts,
    provenanceOk,
    genericnessFlag,
  });

  return {
    body: draft.body,
    wordCount,
    provenanceOk,
    violations,
    genericnessFlag,
    standards,
    requiresHumanEdit: true,
  };
}

export type { CoverLetterStandardsReport, StandardCheck } from "./standards";
