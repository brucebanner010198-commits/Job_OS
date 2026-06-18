"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { scopeData } from "@/lib/profiles/scope";
import { tailorResume } from "@/lib/resume/tailor";
import { renderResumeHtml } from "@/lib/resume/render";
import { generateCoverLetter } from "@/lib/coverletter/generate";
import {
  saveTailoredResume,
  loadTargetContext,
} from "@/lib/resume/service";
import { saveCoverLetter } from "@/lib/coverletter/service";
import type { CoverLetterStandardsReport } from "@/lib/coverletter/standards";
import { scheduleCareerRefresh } from "@/lib/career/trigger";
import type { ProvenanceViolation } from "@/lib/resume/provenance";
import { generateRecruiterSummary } from "@/lib/resume/recruiter-summary";
import type { RecruiterSummary } from "@/lib/resume/recruiter-summary";

export interface CreateTargetInput {
  title: string;
  company: string;
  jobDescription: string;
  sourceUrl?: string;
}

export async function createTargetAction(
  input: CreateTargetInput,
): Promise<string> {
  await requireAccessForMutation();
  const { user, scope } = await getAppContext();
  const target = await db.target.create({
    data: {
      ...scopeData(scope),
      title: input.title.trim(),
      company: input.company.trim(),
      jobDescription: input.jobDescription.trim(),
      sourceUrl: input.sourceUrl?.trim() || null,
    },
  });

  after(() => {
    scheduleCareerRefresh(scope);
  });

  revalidatePath("/resume");
  return target.id;
}

export interface TailorActionResult {
  resumeVersionId: string;
  html: string;
  skimHtml: string;
  exportable: boolean;
  violations: ProvenanceViolation[];
  screening: import("@/lib/resume/screening-score").ScreeningScore;
  recruiterSummary: RecruiterSummary;
}

export async function tailorResumeAction(
  targetId: string,
): Promise<TailorActionResult> {
  await requireAccessForMutation();
  const { user, scope } = await getAppContext();
  const { target, facts, contact } = await loadTargetContext(scope, targetId);

  const result = await tailorResume({
    facts,
    jobTitle: target.title,
    company: target.company,
    jobDescription: target.jobDescription,
    contact: {
      name: contact.name ?? user.name ?? user.email,
      email: contact.email,
      phone: contact.phone,
      location: contact.location,
      links: contact.links,
    },
  });

  const resumeVersionId = await saveTailoredResume(scope, targetId, result);

  return {
    resumeVersionId,
    html: renderResumeHtml(result.resume),
    skimHtml: renderResumeHtml(result.resume, {
      highlightSkim: result.skim.zone,
    }),
    exportable: result.exportable,
    violations: result.provenance.violations,
    screening: result.screening,
    recruiterSummary: generateRecruiterSummary({
      resume: result.resume,
      screening: result.screening,
      jobTitle: target.title,
      company: target.company,
    }),
  };
}

export interface CoverLetterActionResult {
  coverLetterId: string;
  body: string;
  wordCount: number;
  provenanceOk: boolean;
  violations: string[];
  genericnessFlag: boolean;
  standards: CoverLetterStandardsReport;
}

export async function generateCoverLetterAction(
  targetId: string,
): Promise<CoverLetterActionResult> {
  await requireAccessForMutation();
  const { user, scope } = await getAppContext();
  const { target, facts, contact } = await loadTargetContext(scope, targetId);

  const result = await generateCoverLetter({
    facts,
    jobTitle: target.title,
    company: target.company,
    jobDescription: target.jobDescription,
    contactName: contact.name ?? user.name ?? user.email,
  });

  const coverLetterId = await saveCoverLetter(scope, targetId, result);

  return {
    coverLetterId,
    body: result.body,
    wordCount: result.wordCount,
    provenanceOk: result.provenanceOk,
    violations: result.violations,
    genericnessFlag: result.genericnessFlag,
    standards: result.standards,
  };
}
