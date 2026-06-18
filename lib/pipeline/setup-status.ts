/**
 * Setup completion gate - resume entries + saved goals (3-input vision).
 */
import { listFacts, listNotes } from "@/lib/profile/service";
import { getGoal } from "@/lib/goals/service";
import type { AppScope } from "@/lib/profiles/types";
import type { PipelineStageId } from "@/lib/pipeline/stages";

export interface SetupStatus {
  hasResume: boolean;
  hasGoals: boolean;
  resumeCount: number;
  /** True when resume + goals exist but coaching was skipped on Path A. */
  setupPartial: boolean;
  complete: boolean;
}

const LEGACY_PARTIAL_MARKER = "Onboarding completed with coaching skipped";

/** Detect setup-partial flag from a profile note (backward compatible). */
export function isSetupPartialNote(source: string, rawText: string): boolean {
  if (source === "setup-partial") return true;
  if (source === "onboarding-coaching" && rawText.includes(LEGACY_PARTIAL_MARKER)) {
    return true;
  }
  return false;
}

export function detectSetupPartial(
  notes: { source: string; rawText: string }[],
): boolean {
  return notes.some((n) => isSetupPartialNote(n.source, n.rawText));
}

export async function getSetupStatus(scope: AppScope): Promise<SetupStatus> {
  const [facts, goal, notes] = await Promise.all([
    listFacts(scope),
    getGoal(scope),
    listNotes(scope, { limit: 50 }),
  ]);

  const hasResume = facts.length > 0;
  const hasGoals =
    goal !== null &&
    Boolean(
      goal.northStar?.trim() ||
        goal.summary?.trim() ||
        goal.targetTitles.some((t) => t.trim()),
    );
  const setupPartial = detectSetupPartial(notes);

  return {
    hasResume,
    hasGoals,
    resumeCount: facts.length,
    setupPartial,
    complete: hasResume && hasGoals,
  };
}

/** Default home-stage when on `/` - setup if incomplete, else searching. */
export function defaultHomeStage(setup: SetupStatus): PipelineStageId {
  return setup.complete ? "searching" : "setup";
}
