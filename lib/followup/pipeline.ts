/**
 * Follow-up cadence PIPELINE (Phase 7 booster). Pure glue between the cadence
 * brain (lib/followup/cadence.ts) and the serializable view model - no DB, no
 * network, no wall-clock read (the caller injects `nowIso`). The service maps
 * Prisma rows into ApplicationTimeline[]; tests + the offline /boosters preview
 * feed the fixtures straight through.
 *
 * Safety spine carried here:
 *   - DRAFT-FIRST: every view carries the cadence's polite, fact-grounded draft
 *     verbatim - this layer never invents copy and never sends anything.
 *   - The synthetic preview id ("preview-…") is clearly NOT a DB id, so the UI
 *     can tell a previewed nudge from a persisted one.
 */
import { planFollowUps } from "@/lib/followup/cadence";
import { FIXTURE_NOW, fixtureTimelines } from "@/lib/followup/fixtures";
import type {
  ApplicationTimeline,
  FollowUpView,
} from "@/lib/followup/types";

/**
 * Plan the follow-ups for every timeline as of `nowIso` and flatten them into
 * the serializable view model. Each computed FollowUp becomes one view with a
 * synthetic preview id, a PENDING state, and the company/jobTitle carried from
 * its timeline. Terminal-status timelines contribute nothing (the brain returns
 * [] for them), so the cadence's "stop on REJECTED/SKIPPED" rule holds here too.
 */
export function processFollowUps(
  timelines: ApplicationTimeline[],
  nowIso: string,
): FollowUpView[] {
  const views: FollowUpView[] = [];

  for (const timeline of timelines) {
    for (const followUp of planFollowUps(timeline, nowIso)) {
      views.push({
        id: `preview-${timeline.applicationId}-${followUp.kind}`,
        applicationId: timeline.applicationId,
        company: timeline.company,
        jobTitle: timeline.jobTitle,
        kind: followUp.kind,
        dueAt: followUp.dueAt,
        urgency: followUp.urgency,
        draftSubject: followUp.draftSubject,
        draftBody: followUp.draftBody,
        rationale: followUp.rationale,
        state: "PENDING",
      });
    }
  }

  return views;
}

/**
 * The offline /boosters preview: run the deterministic fixture timelines through
 * the cadence at the constant FIXTURE_NOW. Renders identically with or without a
 * database, and exercises every cadence branch.
 */
export function previewFollowUps(): { followUps: FollowUpView[] } {
  const timelines = fixtureTimelines.map((f) => f.timeline);
  return { followUps: processFollowUps(timelines, FIXTURE_NOW) };
}
