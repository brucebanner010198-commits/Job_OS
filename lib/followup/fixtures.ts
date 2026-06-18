/**
 * Deterministic follow-up corpus for Phase 7. Used by the cadence test gate and
 * the offline /boosters preview. All timestamps are fixed and a constant NOW is
 * injected, so nothing depends on the wall clock.
 *
 * The cases cover every cadence branch: an over-due application nudge, a not-yet
 * due one (don't nag), a same-day post-interview thank-you, a stale-interview
 * check-in, an offer acknowledgement, and a REJECTED application that must
 * produce NOTHING (terminal-status stop).
 */

import type {
  ApplicationTimeline,
  FollowUpKind,
} from "@/lib/followup/types";

/** The constant "now" tests inject (matches the fixture build date). */
export const FIXTURE_NOW = "2026-06-16T12:00:00.000Z";

export interface FixtureTimeline {
  timeline: ApplicationTimeline;
  /** The follow-up kinds the cadence MUST produce for this case (ground truth). */
  expectedKinds: FollowUpKind[];
  note: string;
}

export const fixtureTimelines: FixtureTimeline[] = [
  {
    note: "Applied 8 days ago, silence → a (now overdue) application nudge.",
    expectedKinds: ["APPLICATION_NUDGE"],
    timeline: {
      applicationId: "app-stripe",
      company: "Stripe",
      jobTitle: "Backend Engineer",
      status: "APPLIED",
      appliedAt: "2026-06-08T17:30:00.000Z",
      lastContactAt: "2026-06-08T17:30:00.000Z",
    },
  },
  {
    note: "Applied 2 days ago → nudge is UPCOMING, not yet due (never nag early).",
    expectedKinds: ["APPLICATION_NUDGE"],
    timeline: {
      applicationId: "app-coinbase",
      company: "Coinbase",
      jobTitle: "Backend Engineer",
      status: "APPLIED",
      appliedAt: "2026-06-14T15:55:00.000Z",
      lastContactAt: "2026-06-14T15:55:00.000Z",
    },
  },
  {
    note: "Interviewed yesterday → thank-you due within 24h (the high-value nudge).",
    expectedKinds: ["INTERVIEW_THANK_YOU"],
    timeline: {
      applicationId: "app-vercel",
      company: "Vercel",
      jobTitle: "Senior Frontend Engineer",
      status: "INTERVIEWING",
      appliedAt: "2026-05-28T10:00:00.000Z",
      lastInterviewAt: "2026-06-15T16:00:00.000Z",
      lastContactAt: "2026-06-15T16:00:00.000Z",
    },
  },
  {
    note: "Interviewed 9 days ago, silence → a check-in (thank-you window long passed).",
    expectedKinds: ["POST_INTERVIEW_CHECKIN"],
    timeline: {
      applicationId: "app-airbnb",
      company: "Airbnb",
      jobTitle: "Software Engineer",
      status: "INTERVIEWING",
      appliedAt: "2026-05-20T10:00:00.000Z",
      lastInterviewAt: "2026-06-07T15:00:00.000Z",
      lastContactAt: "2026-06-07T15:00:00.000Z",
    },
  },
  {
    note: "Offer in hand → acknowledge + buy time to negotiate (hand to salary coach).",
    expectedKinds: ["OFFER_RESPONSE"],
    timeline: {
      applicationId: "app-datadog",
      company: "Datadog",
      jobTitle: "Senior Software Engineer",
      status: "OFFER",
      appliedAt: "2026-05-25T10:00:00.000Z",
      lastContactAt: "2026-06-15T19:20:00.000Z",
    },
  },
  {
    note: "REJECTED → terminal status produces NOTHING (the cadence stops).",
    expectedKinds: [],
    timeline: {
      applicationId: "app-figma",
      company: "Figma",
      jobTitle: "Product Engineer",
      status: "REJECTED",
      appliedAt: "2026-05-30T10:00:00.000Z",
      lastContactAt: "2026-06-12T18:05:00.000Z",
    },
  },
];
