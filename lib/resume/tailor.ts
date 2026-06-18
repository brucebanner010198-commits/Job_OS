import { chatJson } from "@/lib/ai/openrouter";
import {
  tailoredResumeSchema,
  type TailoredResume,
} from "./schema";
import {
  auditProvenance,
  type ProvenanceReport,
  type SourceEntry,
} from "./provenance";
import { ATS, screeningPromptBlock } from "./ats-rules";
import { bulletFrameworkPromptBlock } from "./bullet-frameworks";
import { scoreScreening, type ScreeningScore } from "./screening-score";
import { applySkimLayout, type SkimLayoutResult } from "./skim-layout";
import { type ProfileFact, flattenFact } from "@/lib/profile/types";

export type { ProfileFact };

export interface TailorInput {
  facts: ProfileFact[];
  jobTitle: string;
  company: string;
  jobDescription: string;
  contact: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
  seniority?: keyof typeof ATS.pageTargetBySeniority;
}

export interface TailorResult {
  resume: TailoredResume;
  provenance: ProvenanceReport;
  /** ATS keyword + 6-second skim score (post-generation, no LLM). */
  screening: ScreeningScore;
  /** Post-processed skim zone metadata (bullet reorder, top-third map). */
  skim: SkimLayoutResult;
  /** true only when provenance passed - i.e. safe to export */
  exportable: boolean;
}

function factListing(facts: ProfileFact[]): string {
  return facts
    .map((f) => `[${f.id}] (${f.kind}) ${flattenFact(f)}`)
    .join("\n");
}

function buildSystemPrompt(
  seniority: keyof typeof ATS.pageTargetBySeniority,
  jobTitle: string,
): string {
  return `You are an expert resume writer who is FORBIDDEN from inventing anything.

Hard rules:
- EXTRACTIVE ONLY. You may only use facts present in the provided MASTER PROFILE entries. Never invent or infer an employer, title, date, metric, skill, or achievement that is not in those entries.
- Every bullet, summary, experience, education, and skill group MUST list the exact entry ids ("sources") it was derived from. Only use ids that appear in the MASTER PROFILE.
- Every NUMBER/METRIC you write (%, $, counts, multipliers) must appear verbatim in one of the cited source entries. If a quantity is not in the sources, do not state it.
- Mirror the JOB DESCRIPTION's CONCEPTS and terminology where they genuinely match the candidate's real experience. Do NOT keyword-stuff or repeat a term more than ${ATS.maxKeywordRepeat} times.
- Reorder bullets so the most job-relevant, quantified achievements come first.
- Dates are MM/YYYY (or "Present"). Use standard section content only.
- Keep it tight: at most ${ATS.maxBulletsPerRole} bullets per role; concise, scannable phrasing for a recruiter's ~6-second first pass.

${screeningPromptBlock(seniority, jobTitle)}

${bulletFrameworkPromptBlock({ seniority })}

Return ONLY a JSON object matching the required schema.`;
}

export async function tailorResume(input: TailorInput): Promise<TailorResult> {
  const facts = input.facts.filter((f) => !f.sensitive);
  const seniority = input.seniority ?? "mid";
  const pageTarget = ATS.pageTargetBySeniority[seniority];

  const user = `MASTER PROFILE (id-tagged - cite these ids as "sources"):
${factListing(facts)}

TARGET ROLE: ${input.jobTitle} at ${input.company}
CANDIDATE CONTACT: ${JSON.stringify(input.contact)}
LENGTH TARGET: about ${pageTarget} page(s).

JOB DESCRIPTION:
${input.jobDescription}

Produce the tailored, fully-sourced resume JSON now. Set forJobTitle="${input.jobTitle}", forCompany="${input.company}", and put the candidate name in "name" and the target role in "headline".`;

  const { value: raw } = await chatJson(tailoredResumeSchema, {
    task: "tailorResume",
    temperature: 0.2,
    messages: [
      { role: "system", content: buildSystemPrompt(seniority, input.jobTitle) },
      { role: "user", content: user },
    ],
  });

  const skim = applySkimLayout(raw);
  const resume = skim.resume;

  const sources: SourceEntry[] = facts.map((f) => ({
    id: f.id,
    text: flattenFact(f),
  }));
  const provenance = auditProvenance(resume, sources);
  const screening = scoreScreening({
    resume,
    jobDescription: input.jobDescription,
    seniority,
  });

  return { resume, provenance, screening, skim, exportable: provenance.ok };
}
