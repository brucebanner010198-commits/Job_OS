/**
 * Career-coaching conversation orchestrator for onboarding.
 *
 * Multi-turn LLM session with gap detection and intelligent stop conditions.
 * Does not invent facts — probes for depth, confirms critical gaps, and stops
 * when coverage is sufficient or the user explicitly declines further detail.
 */
import { z } from "zod";
import { chatJson } from "@/lib/ai/openrouter";
import type {
  CoachingCoverage,
  CoachingTurn,
  CoachingTurnResult,
  OnboardingPath,
} from "./types";

const sectionStatus = z.enum(["missing", "partial", "confirmed"]);

const coverageSchema = z.object({
  sufficient: z.boolean(),
  gaps: z.array(z.string()),
  sections: z.object({
    experience: sectionStatus,
    education: sectionStatus,
    skills: sectionStatus,
    certifications: sectionStatus,
    projects: sectionStatus,
    goals: sectionStatus,
  }),
});

const coachingResponseSchema = z.object({
  assistantMessage: z.string(),
  coverage: coverageSchema,
  shouldStop: z.boolean(),
  finalGapCheck: z.boolean().optional(),
  remainingGaps: z.array(z.string()).optional(),
});

const COACHING_SYSTEM =
  "You are a patient, thorough career coach helping someone build a complete " +
  "master profile during onboarding. Your job is to gather exhaustive career " +
  "information through dialogue — not to invent anything.\n\n" +
  "Collect and confirm:\n" +
  "- Career history (roles, employers, dates, responsibilities, achievements, metrics)\n" +
  "- Education (degrees, institutions, dates, honors)\n" +
  "- Certification/license codes and credential identifiers where applicable\n" +
  "- Courses, training, skills (technical and non-technical)\n" +
  "- Projects, publications, awards\n" +
  "- Detailed career goals (target roles, industries, timelines)\n" +
  "- Future aspirations (long-term direction, north-star vision)\n\n" +
  "Rules:\n" +
  "1. ALWAYS ask one focused clarifying question when input is missing, ambiguous, " +
  "incomplete, or inconsistent. Do not move on until resolved or the user declines.\n" +
  "2. If the user mentions a role without dates, metrics, or scope — ask ONE follow-up.\n" +
  "3. If the user says they are done ('that's everything', 'nothing else', etc.), " +
  "set finalGapCheck:true and list remaining critical gaps in remainingGaps — ask " +
  "one confirmation question about those gaps.\n" +
  "4. If the user repeatedly declines to elaborate on the same topic (2+ times), " +
  "acknowledge the gap and move on — do not nag.\n" +
  "5. Set shouldStop:true ONLY when: (a) major sections are at least partial, " +
  "goals section is partial or confirmed, AND user confirmed OR coverage.sufficient; " +
  "OR (b) user explicitly confirmed after finalGapCheck.\n" +
  "6. Never invent employers, titles, dates, metrics, or skills.\n" +
  "7. Keep assistantMessage conversational, warm, and concise (2-4 sentences + one question).\n\n" +
  'Respond ONLY as JSON: { "assistantMessage", "coverage": { "sufficient", "gaps", ' +
  '"sections": { "experience", "education", "skills", "certifications", "projects", "goals" } }, ' +
  '"shouldStop", "finalGapCheck"?, "remainingGaps"? }';

function defaultCoverage(): CoachingCoverage {
  return {
    sufficient: false,
    gaps: ["Career history", "Goals"],
    sections: {
      experience: "missing",
      education: "missing",
      skills: "missing",
      certifications: "missing",
      projects: "missing",
      goals: "missing",
    },
  };
}

function buildContextBlock(
  path: OnboardingPath,
  profileText: string,
  initialPaste?: string,
): string {
  const parts = [`ONBOARDING PATH: ${path === "resume" ? "Has resume (imported)" : "No resume"}`];
  if (profileText.trim()) {
    parts.push(`EXISTING PROFILE (non-sensitive):\n${profileText}`);
  }
  if (initialPaste?.trim()) {
    parts.push(`INITIAL PASTE FROM USER:\n${initialPaste}`);
  }
  return parts.join("\n\n");
}

/**
 * Generate the opening coaching message based on path and existing profile.
 */
export async function startCoachingSession(input: {
  path: OnboardingPath;
  profileText: string;
  initialPaste?: string;
}): Promise<CoachingTurnResult> {
  const context = buildContextBlock(input.path, input.profileText, input.initialPaste);

  const userPrompt =
    input.path === "resume"
      ? `${context}\n\nThe user just imported their resume. Review what we have, ` +
        "acknowledge it briefly, then ask your first focused question about the biggest " +
        "gap or something goals-related that resumes rarely capture."
      : `${context}\n\nThe user does not have a resume. Start warmly and ask them to ` +
        "walk you through their most recent role — title, company, dates, and one key win.";

  const { value } = await chatJson(coachingResponseSchema, {
    task: "onboardingCoaching",
    temperature: 0.4,
    maxTokens: 800,
    messages: [
      { role: "system", content: COACHING_SYSTEM },
      { role: "user", content: userPrompt },
    ],
  });

  return normalizeResult(value);
}

/**
 * Process one user turn in the coaching conversation.
 */
export async function processCoachingTurn(input: {
  path: OnboardingPath;
  turns: CoachingTurn[];
  userMessage: string;
  profileText: string;
  initialPaste?: string;
}): Promise<CoachingTurnResult> {
  const context = buildContextBlock(input.path, input.profileText, input.initialPaste);
  const history = input.turns.map((t) => ({
    role: t.role as "user" | "assistant",
    content: t.content,
  }));

  const doneSignal = userDoneSignal(input.userMessage);
  const userContent =
    `${context}\n\n` +
    (doneSignal
      ? "The user signaled they are done providing information. Run final gap check.\n\n"
      : "") +
    `USER MESSAGE:\n${input.userMessage}`;

  const { value } = await chatJson(coachingResponseSchema, {
    task: "onboardingCoaching",
    temperature: 0.4,
    maxTokens: 900,
    messages: [
      { role: "system", content: COACHING_SYSTEM },
      ...history,
      { role: "user", content: userContent },
    ],
  });

  return normalizeResult(value);
}

export function userDoneSignal(text: string): boolean {
  return /\b(that'?s (everything|all|it)|nothing else|i'?m done|no more|that'?s all i have)\b/i.test(
    text,
  );
}

/**
 * Client/server stop gating — when to proceed to compile vs show final gap check.
 */
export function evaluateCoachingStop(input: {
  shouldStop: boolean;
  finalGapCheck: boolean;
  coverageSufficient: boolean;
  userSignaledDone: boolean;
  remainingGaps: string[];
}): { proceedToCompile: boolean; showFinalGapCheck: boolean } {
  const showFinalGapCheck =
    input.finalGapCheck ||
    (input.userSignaledDone && input.remainingGaps.length > 0 && !input.shouldStop);

  const proceedToCompile =
    input.shouldStop ||
    (input.coverageSufficient && input.userSignaledDone && input.remainingGaps.length === 0);

  return { proceedToCompile, showFinalGapCheck };
}

function normalizeResult(raw: z.infer<typeof coachingResponseSchema>): CoachingTurnResult {
  const coverage: CoachingCoverage = {
    sufficient: raw.coverage.sufficient,
    gaps: raw.coverage.gaps,
    sections: raw.coverage.sections as CoachingCoverage["sections"],
  };

  return {
    assistantMessage: raw.assistantMessage,
    coverage,
    shouldStop: raw.shouldStop,
    finalGapCheck: raw.finalGapCheck ?? false,
    remainingGaps: raw.remainingGaps ?? [],
  };
}
