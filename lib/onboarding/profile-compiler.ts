/**
 * Compile onboarding collected data into a structured profile with provenance.
 *
 * Merges resume import, initial paste, and coaching conversation turns.
 * Conversation-confirmed data takes precedence over resume import on conflict.
 * Flags inferred/unconfirmed fields for user review.
 */
import { z } from "zod";
import { chatJson } from "@/lib/ai/openrouter";
import { synthesizeGoals } from "@/lib/goals/elicit";
import { normalizeMilestones, type CareerGoalData } from "@/lib/goals/types";
import type {
  CoachingTurn,
  CompiledEntry,
  CompiledProfile,
  EntryProvenance,
  OnboardingPath,
} from "./types";

const PROVENANCE_PRIORITY: Record<EntryProvenance, number> = {
  conversation: 3,
  paste: 2,
  resume: 1,
};

function entryKey(entry: Pick<CompiledEntry, "kind" | "title">): string {
  return `${entry.kind}:${entry.title.trim().toLowerCase()}`;
}

/**
 * Resolve duplicate entries by provenance — conversation overrides paste overrides resume.
 */
export function mergeEntriesByProvenance(entries: CompiledEntry[]): CompiledEntry[] {
  const byKey = new Map<string, CompiledEntry>();
  for (const entry of entries) {
    const key = entryKey(entry);
    const existing = byKey.get(key);
    if (
      !existing ||
      PROVENANCE_PRIORITY[entry.provenance] > PROVENANCE_PRIORITY[existing.provenance]
    ) {
      byKey.set(key, entry);
    }
  }
  return Array.from(byKey.values());
}

const ENTRY_KIND = z.enum([
  "CONTACT",
  "SUMMARY",
  "EXPERIENCE",
  "EDUCATION",
  "PROJECT",
  "SKILL",
  "ACHIEVEMENT",
  "CERTIFICATION",
  "LIFE_FACT",
]);

const compiledEntrySchema = z.object({
  kind: ENTRY_KIND,
  title: z.string(),
  data: z.record(z.string(), z.unknown()),
  sensitive: z.boolean(),
  provenance: z.enum(["resume", "paste", "conversation"]),
  inferred: z.boolean().optional(),
});

const compileSchema = z.object({
  entries: z.array(compiledEntrySchema),
  goalsNote: z.string(),
});

const COMPILE_SYSTEM =
  "You compile a complete career profile from onboarding sources. Extract ONLY " +
  "facts the user provided or confirmed — never invent employers, titles, dates, " +
  "metrics, or skills.\n\n" +
  "For each entry set provenance:\n" +
  "- resume: from imported resume text\n" +
  "- paste: from initial paste (no-resume path)\n" +
  "- conversation: from coaching dialogue\n\n" +
  "On conflicts between resume and conversation, prefer conversation (user-confirmed).\n" +
  "Set inferred:true on fields you had to guess or that lack explicit confirmation.\n" +
  "Mark sensitive protected-class info as LIFE_FACT with sensitive:true.\n\n" +
  "Data shapes: CONTACT, SUMMARY, EXPERIENCE, EDUCATION, PROJECT, SKILL, " +
  "ACHIEVEMENT, CERTIFICATION, LIFE_FACT — same as master profile schema.\n\n" +
  "Also produce goalsNote: a free-text summary of stated career goals, aspirations, " +
  "target roles, industries, and timelines from the conversation.\n\n" +
  'Respond ONLY as JSON: { "entries": [{ "kind", "title", "data", "sensitive", ' +
  '"provenance", "inferred"? }], "goalsNote" }.';

function formatTurns(turns: CoachingTurn[]): string {
  if (turns.length === 0) return "(no coaching conversation)";
  return turns
    .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
    .join("\n\n");
}

/**
 * Compile all onboarding inputs into structured entries + goals note (preview).
 */
export async function compileOnboardingProfile(input: {
  path: OnboardingPath;
  turns: CoachingTurn[];
  profileText: string;
  resumeText?: string;
  initialPaste?: string;
}): Promise<CompiledProfile> {
  const sources = [
    `PATH: ${input.path}`,
    input.resumeText?.trim()
      ? `RESUME IMPORT TEXT:\n${input.resumeText}`
      : null,
    input.initialPaste?.trim()
      ? `INITIAL PASTE:\n${input.initialPaste}`
      : null,
    input.profileText.trim()
      ? `EXISTING PROFILE ENTRIES:\n${input.profileText}`
      : null,
    `COACHING CONVERSATION:\n${formatTurns(input.turns)}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const { value } = await chatJson(compileSchema, {
    task: "onboardingCoaching",
    temperature: 0.2,
    maxTokens: 4000,
    messages: [
      { role: "system", content: COMPILE_SYSTEM },
      { role: "user", content: sources },
    ],
  });

  const entries: CompiledEntry[] = mergeEntriesByProvenance(
    value.entries.map((e) => ({
      kind: e.kind,
      title: e.title,
      data: {
        ...e.data,
        ...(e.inferred ? { inferred: true } : {}),
      },
      sensitive: e.sensitive,
      provenance: e.provenance as EntryProvenance,
    })),
  );

  const unconfirmedCount = entries.filter(
    (e) => e.data.inferred === true,
  ).length;

  return {
    entries,
    goalsNote: value.goalsNote,
    unconfirmedCount,
  };
}

/**
 * Synthesize structured goals from the compiled goals note + profile context.
 */
export async function compileGoalsFromNote(input: {
  goalsNote: string;
  profileText: string;
}): Promise<CareerGoalData> {
  const data = await synthesizeGoals({
    note: input.goalsNote,
    profileText: input.profileText,
  });
  return { ...data, milestones: normalizeMilestones(data.milestones) };
}
