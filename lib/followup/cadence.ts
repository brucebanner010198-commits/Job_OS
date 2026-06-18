/**
 * Follow-up cadence BRAIN (Phase 7 booster, plan §10).
 * Pure - no LLM, no DB, no network, no wall-clock reads. The caller injects the
 * current time as `nowIso`; all time math runs off `Date.parse` + millisecond
 * offsets so the function is fully deterministic and unit-testable.
 *
 * Safety spine:
 *   - STOPS on a terminal status: REJECTED / SKIPPED produce nothing.
 *   - NEVER nags early: an application nudge only comes due after a minimum
 *     spacing, and the post-interview thank-you is the single high-value nudge.
 *   - DRAFT-FIRST: every nudge carries a polite, specific drafted message that
 *     is grounded ONLY in the timeline's real facts (company, jobTitle). It
 *     never invents a relationship, a metric, or a market number, and it is
 *     never auto-sent - the human edits and sends.
 */
import type {
  ApplicationTimeline,
  FollowUp,
  FollowUpKind,
  FollowUpUrgency,
} from "@/lib/followup/types";
import {
  APPLICATION_NUDGE_DAYS,
  OFFER_RESPONSE_HOURS,
  POST_INTERVIEW_CHECKIN_DAYS,
  TERMINAL_STATUSES,
  THANK_YOU_HOURS,
} from "@/lib/followup/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** ISO `iso` shifted forward by `days` calendar days, re-serialized to ISO. */
function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * DAY_MS).toISOString();
}

/** ISO `iso` shifted forward by `hours` hours, re-serialized to ISO. */
function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * HOUR_MS).toISOString();
}

/**
 * Urgency of a nudge relative to the injected now:
 *   - due in the future            → "upcoming"
 *   - overdue by at most two days   → "due"
 *   - overdue by more than two days → "overdue"
 */
function urgencyFor(dueIso: string, nowIso: string): FollowUpUrgency {
  const dueMs = Date.parse(dueIso);
  const nowMs = Date.parse(nowIso);
  if (dueMs > nowMs) return "upcoming";
  if (nowMs - dueMs <= 2 * DAY_MS) return "due";
  return "overdue";
}

/** "the Backend Engineer role" when a title is known, else "the role". */
function rolePhrase(timeline: ApplicationTimeline): string {
  return timeline.jobTitle ? `the ${timeline.jobTitle} role` : "the role";
}

/** Assemble a FollowUp, deriving urgency from `dueAt` vs `nowIso`. */
function build(
  kind: FollowUpKind,
  dueAt: string,
  draftSubject: string,
  draftBody: string,
  rationale: string,
  nowIso: string,
): FollowUp {
  return {
    kind,
    dueAt,
    urgency: urgencyFor(dueAt, nowIso),
    draftSubject,
    draftBody,
    rationale,
  };
}

/** Applied, silence → reiterate interest (grounded only in the application). */
function applicationNudge(
  timeline: ApplicationTimeline,
  appliedAt: string,
  nowIso: string,
): FollowUp {
  const { company } = timeline;
  const role = rolePhrase(timeline);
  return build(
    "APPLICATION_NUDGE",
    addDays(appliedAt, APPLICATION_NUDGE_DAYS),
    `Following up on my application - ${company}`,
    `Hi,\n\nI recently applied for ${role} at ${company} and wanted to ` +
      `reiterate how interested I am in the opportunity. I'd welcome the ` +
      `chance to discuss how I could contribute, and I'm happy to share ` +
      `anything that would be helpful as you review applications.\n\n` +
      `Thank you for your time.`,
    `You applied to ${company} and haven't heard back - a brief note ` +
      `reiterates your interest without nagging.`,
    nowIso,
  );
}

/** Just interviewed → prompt thank-you (the highest-value nudge). */
function interviewThankYou(
  timeline: ApplicationTimeline,
  lastInterviewAt: string,
  nowIso: string,
): FollowUp {
  const { company } = timeline;
  const role = rolePhrase(timeline);
  return build(
    "INTERVIEW_THANK_YOU",
    addHours(lastInterviewAt, THANK_YOU_HOURS),
    `Thank you for the interview - ${company}`,
    `Hi,\n\nThank you for taking the time to interview me for ${role} at ` +
      `${company}. I enjoyed the conversation and came away even more ` +
      `excited about the team and the work. Please let me know if there's ` +
      `anything further I can provide.\n\nThanks again.`,
    `You interviewed at ${company} - a prompt thank-you note is the ` +
      `highest-value follow-up.`,
    nowIso,
  );
}

/** Interviewed, silence for a week → polite check-in on next steps. */
function postInterviewCheckin(
  timeline: ApplicationTimeline,
  lastInterviewAt: string,
  nowIso: string,
): FollowUp {
  const { company } = timeline;
  const role = rolePhrase(timeline);
  return build(
    "POST_INTERVIEW_CHECKIN",
    addDays(lastInterviewAt, POST_INTERVIEW_CHECKIN_DAYS),
    `Checking in on next steps - ${company}`,
    `Hi,\n\nI wanted to check in following my interview for ${role} at ` +
      `${company}. I remain very interested and would appreciate any update ` +
      `on the timeline or next steps in the process. Thank you for keeping ` +
      `me in mind.\n\nBest regards.`,
    `It's been about a week since your ${company} interview with no ` +
      `update - a polite check-in asks about next steps.`,
    nowIso,
  );
}

/** Offer in hand → acknowledge warmly and buy time to review (hand to coach). */
function offerResponse(
  timeline: ApplicationTimeline,
  baseIso: string,
  nowIso: string,
): FollowUp {
  const { company } = timeline;
  const role = rolePhrase(timeline);
  return build(
    "OFFER_RESPONSE",
    addHours(baseIso, OFFER_RESPONSE_HOURS),
    `Thank you for the offer - ${company}`,
    `Hi,\n\nThank you so much for the offer for ${role} at ${company} - ` +
      `I'm genuinely excited about it. So that I can give it the ` +
      `consideration it deserves, would it be possible to have a few days ` +
      `to review the details? I'll follow up with any questions shortly.\n\n` +
      `Thank you again.`,
    `${company} extended an offer - acknowledge it warmly and ask for a ` +
      `few days to review before responding.`,
    nowIso,
  );
}

/**
 * Plan the live follow-ups for one application timeline, as of `nowIso`.
 * Returns [] for terminal statuses and for states with no live nudge
 * (WARM_PATH / TO_APPLY). Never reads the system clock.
 */
export function planFollowUps(
  timeline: ApplicationTimeline,
  nowIso: string,
): FollowUp[] {
  if (TERMINAL_STATUSES.has(timeline.status)) return [];

  switch (timeline.status) {
    case "APPLIED": {
      if (!timeline.appliedAt) return [];
      return [applicationNudge(timeline, timeline.appliedAt, nowIso)];
    }
    case "INTERVIEWING": {
      if (!timeline.lastInterviewAt) return [];
      const ageDays =
        (Date.parse(nowIso) - Date.parse(timeline.lastInterviewAt)) / DAY_MS;
      if (ageDays < POST_INTERVIEW_CHECKIN_DAYS) {
        return [interviewThankYou(timeline, timeline.lastInterviewAt, nowIso)];
      }
      return [postInterviewCheckin(timeline, timeline.lastInterviewAt, nowIso)];
    }
    case "OFFER": {
      const base = timeline.lastContactAt ?? nowIso;
      return [offerResponse(timeline, base, nowIso)];
    }
    case "WARM_PATH":
    case "TO_APPLY":
    case "REJECTED":
    case "SKIPPED":
      return [];
  }
}
