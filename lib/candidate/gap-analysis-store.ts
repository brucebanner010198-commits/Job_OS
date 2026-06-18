/**
 * Server-only persistence for gap analysis coach notes.
 * Kept separate from gap-analysis.ts so client components can import pure analysis.
 */
import { storeCoachNote } from "@/lib/coach/notes";
import type { AppScope } from "@/lib/profiles/types";
import {
  formatGapAnalysisBody,
  type GapAnalysisResult,
} from "@/lib/candidate/gap-analysis";

/** Persist gap analysis as a coach ProfileNote. */
export async function storeGapAnalysisCoachNote(
  scope: AppScope,
  result: GapAnalysisResult,
  context: { company?: string; roleTitle?: string },
): Promise<void> {
  const title = context.company
    ? `Gap analysis - ${context.company}`
    : "Gap analysis";
  await storeCoachNote(scope, {
    kind: "gap",
    title,
    body: formatGapAnalysisBody(result, context),
  });
}
