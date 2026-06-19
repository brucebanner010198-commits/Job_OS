"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { ProfileEntryKind } from "@prisma/client";
import { requireAccessForMutation } from "@/lib/auth/require-access";
import { getAppContext } from "@/lib/app-context";
import { addEntries, saveNote } from "@/lib/profile/service";
import { nonSensitiveProfileText } from "@/lib/goals/service";
import { upsertGoal } from "@/lib/goals/service";
import { scheduleCareerRefresh } from "@/lib/career/trigger";
import { scheduleSetupCatchup } from "@/lib/autopilot/triggers";
import { isAutopilotEnabled } from "@/lib/autopilot/setup-trigger";
import { getSetupStatus } from "@/lib/pipeline/setup-status";
import {
  startCoachingSession,
  processCoachingTurn,
} from "@/lib/onboarding/coaching";
import {
  compileOnboardingProfile,
  compileGoalsFromNote,
} from "@/lib/onboarding/profile-compiler";
import type {
  CoachingTurn,
  CoachingTurnResult,
  CompiledProfile,
  OnboardingPath,
} from "@/lib/onboarding/types";
import type { CareerGoalData } from "@/lib/goals/types";

const KIND_VALUES = new Set<string>(Object.values(ProfileEntryKind));

function toKind(kind: string): ProfileEntryKind | null {
  return KIND_VALUES.has(kind) ? (kind as ProfileEntryKind) : null;
}

/** Begin coaching session — returns opening message and initial coverage. */
export async function startCoachingAction(input: {
  path: OnboardingPath;
  initialPaste?: string;
}): Promise<CoachingTurnResult> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const profileText = await nonSensitiveProfileText(scope);
  return startCoachingSession({
    path: input.path,
    profileText,
    initialPaste: input.initialPaste,
  });
}

/** Process one coaching turn. */
export async function coachingTurnAction(input: {
  path: OnboardingPath;
  turns: CoachingTurn[];
  userMessage: string;
  initialPaste?: string;
}): Promise<CoachingTurnResult> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const profileText = await nonSensitiveProfileText(scope);
  return processCoachingTurn({
    path: input.path,
    turns: input.turns,
    userMessage: input.userMessage,
    profileText,
    initialPaste: input.initialPaste,
  });
}

export interface CompilePreviewResult {
  profile: CompiledProfile;
  goals: CareerGoalData;
}

/** Compile preview — does not persist. */
export async function compileOnboardingPreviewAction(input: {
  path: OnboardingPath;
  turns: CoachingTurn[];
  initialPaste?: string;
  resumeText?: string;
}): Promise<CompilePreviewResult> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const profileText = await nonSensitiveProfileText(scope);

  const profile = await compileOnboardingProfile({
    path: input.path,
    turns: input.turns,
    profileText,
    resumeText: input.resumeText,
    initialPaste: input.initialPaste,
  });

  const goals = await compileGoalsFromNote({
    goalsNote: profile.goalsNote || "Career direction to be refined.",
    profileText: profileText + "\n" + profile.entries.map((e) => e.title).join(", "),
  });

  return { profile, goals };
}

export interface CompleteOnboardingResult {
  entriesAdded: number;
  goalsSaved: boolean;
  setupPartial: boolean;
  autopilotEnabled: boolean;
}

/**
 * Persist compiled profile + goals, save coaching transcript, trigger refresh.
 */
export async function completeOnboardingAction(input: {
  path: OnboardingPath;
  turns: CoachingTurn[];
  initialPaste?: string;
  resumeText?: string;
  skipCoaching?: boolean;
}): Promise<CompleteOnboardingResult> {
  await requireAccessForMutation();
  const { scope } = await getAppContext();
  const wasComplete = (await getSetupStatus(scope)).complete;
  const profileText = await nonSensitiveProfileText(scope);

  let profile: CompiledProfile;
  let goals: CareerGoalData;

  if (input.skipCoaching && input.path === "resume") {
    profile = await compileOnboardingProfile({
      path: input.path,
      turns: [],
      profileText,
      resumeText: input.resumeText,
    });
    goals = await compileGoalsFromNote({
      goalsNote: profile.goalsNote || "Goals not captured — please update in Career Goals.",
      profileText,
    });
  } else {
    const preview = await compileOnboardingPreviewAction({
      path: input.path,
      turns: input.turns,
      initialPaste: input.initialPaste,
      resumeText: input.resumeText,
    });
    profile = preview.profile;
    goals = preview.goals;
  }

  // Persist coaching transcript
  if (input.turns.length > 0) {
    const transcript = input.turns
      .map((t) => `${t.role.toUpperCase()}: ${t.content}`)
      .join("\n\n");
    await saveNote(scope, transcript, null, "onboarding-coaching");
  }

  if (input.initialPaste?.trim()) {
    await saveNote(scope, input.initialPaste.trim(), null, "onboarding-paste");
  }

  if (input.skipCoaching) {
    await saveNote(
      scope,
      "Onboarding completed with coaching skipped — goals and gaps may be incomplete.",
      null,
      "setup-partial",
    );
  }

  // For resume path, resume entries already imported — add conversation/paste deltas only
  const entriesToAdd =
    input.path === "resume"
      ? profile.entries.filter((e) => e.provenance !== "resume")
      : profile.entries;

  const dbEntries = entriesToAdd
    .map((e) => {
      const kind = toKind(e.kind);
      if (!kind) return null;
      return {
        kind,
        data: e.data,
        sourceNote: `${e.provenance}:${e.title}`,
        sensitive: e.sensitive,
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  const entriesAdded = await addEntries(scope, dbEntries);
  await upsertGoal(scope, goals, profile.goalsNote || null);

  const nowComplete = (await getSetupStatus(scope)).complete;

  after(() => {
    scheduleCareerRefresh(scope);
    if (!wasComplete && nowComplete) {
      scheduleSetupCatchup(scope);
    }
  });

  revalidatePath("/setup");
  revalidatePath("/master-resume");
  revalidatePath("/goals");
  revalidatePath("/jobs");
  revalidatePath("/");

  return {
    entriesAdded,
    goalsSaved: true,
    setupPartial: Boolean(input.skipCoaching),
    autopilotEnabled: isAutopilotEnabled(),
  };
}

/** Extract initial profile from pasted text without persisting (Path B preview). */
export async function extractInitialPasteAction(
  text: string,
): Promise<{ entryCount: number; preview: string }> {
  await requireAccessForMutation();
  const trimmed = text.trim();
  if (!trimmed) return { entryCount: 0, preview: "" };

  const { extractFromDictation } = await import("@/lib/profile/extract");
  const extracted = await extractFromDictation(trimmed);
  const preview = extracted.entries.map((e) => e.title).join(", ");
  return { entryCount: extracted.entries.length, preview };
}
