/**
 * Deterministic outcome corpus for Phase 9. Used by the KPI test gate and the
 * offline /outcomes preview. A constant NOW is injected and every timestamp is
 * fixed, so nothing depends on the wall clock.
 *
 * The corpus is shaped to exercise the dashboard's whole point - "measure
 * outcomes, flag a lane that isn't converting":
 *   - a COLD lane that is UNDERPERFORMING (8 submitted, only 1 reached interview),
 *   - a WARM lane that is CONVERTING (5 submitted, 3 reached interview, 1 offer),
 *   - one OFFER in hand (→ the salary-coach nudge),
 *   - a SLOW median speed-to-apply (→ the "apply within 24–48h" nudge),
 *   - pipeline + SKIPPED rows that must NOT count toward conversion.
 */
import type {
  ApplicationRecord,
  InterviewRecord,
  LaneKey,
  MetricsInput,
} from "@/lib/metrics/types";

/** The constant "now" tests inject (matches the fixture build date). */
export const FIXTURE_NOW = "2026-06-16T12:00:00.000Z";

const HOUR_MS = 60 * 60 * 1000;
const SEEN_BASE = Date.parse("2026-06-01T09:00:00.000Z");

/**
 * Build an application record. `seenOffsetH` places first-seen relative to the
 * base; `gapH` (when given) is the hours from first-seen to submitted - the
 * speed-to-apply gap. Pipeline rows pass no gap (never submitted).
 */
function mkApp(
  id: string,
  company: string,
  status: ApplicationRecord["status"],
  lane: LaneKey,
  seenOffsetH: number,
  gapH?: number,
): ApplicationRecord {
  const firstSeenAt = new Date(SEEN_BASE + seenOffsetH * HOUR_MS).toISOString();
  const submittedAt =
    gapH === undefined
      ? undefined
      : new Date(SEEN_BASE + (seenOffsetH + gapH) * HOUR_MS).toISOString();
  return {
    id,
    company,
    status,
    lane,
    firstSeenAt,
    submittedAt,
    createdAt: firstSeenAt,
  };
}

export const fixtureApplications: ApplicationRecord[] = [
  // -- Cold lane: 8 submitted, only 1 reached interview → UNDERPERFORMING --
  mkApp("cold-1", "Globex", "APPLIED", "cold", 0, 6),
  mkApp("cold-2", "Initech", "APPLIED", "cold", 24, 30),
  mkApp("cold-3", "Umbrella", "APPLIED", "cold", 48, 50),
  mkApp("cold-4", "Soylent", "INTERVIEWING", "cold", 72, 72),
  mkApp("cold-5", "Hooli", "APPLIED", "cold", 96, 96),
  mkApp("cold-6", "Vandelay", "REJECTED", "cold", 120, 130),
  mkApp("cold-7", "Wonka", "APPLIED", "cold", 144, 18),
  mkApp("cold-8", "Massive Dynamic", "REJECTED", "cold", 168, 150),

  // -- Warm lane: 5 submitted, 3 reached interview, 1 offer → CONVERTING --
  mkApp("warm-1", "Stripe", "INTERVIEWING", "warm", 12, 40),
  mkApp("warm-2", "Linear", "OFFER", "warm", 36, 60),
  mkApp("warm-3", "Notion", "INTERVIEWING", "warm", 60, 80),
  mkApp("warm-4", "Vercel", "APPLIED", "warm", 84, 110),
  mkApp("warm-5", "Ramp", "REJECTED", "warm", 108, 200),

  // -- Pipeline (not yet submitted) - must NOT count toward conversion --
  mkApp("pipe-1", "Figma", "TO_APPLY", "cold", 200),
  mkApp("pipe-2", "Datadog", "TO_APPLY", "cold", 220),
  mkApp("pipe-3", "Airbnb", "WARM_PATH", "warm", 240),

  // -- Skipped - counts toward nothing at all --
  mkApp("skip-1", "Theranos", "SKIPPED", "cold", 260),
];

export const fixtureInterviews: InterviewRecord[] = [
  { id: "sess-1", mode: "STUDY", createdAt: "2026-06-10T10:00:00.000Z" },
  { id: "sess-2", mode: "AI_SCREEN", overall: 72, createdAt: "2026-06-12T14:00:00.000Z" },
  { id: "sess-3", mode: "REAL_HR", overall: 81, createdAt: "2026-06-14T16:00:00.000Z" },
];

export const fixtureMetricsInput: MetricsInput = {
  applications: fixtureApplications,
  interviews: fixtureInterviews,
};

/**
 * Ground-truth expectations the test gate asserts against. Hand-computed from the
 * corpus above so a regression in the brain is caught, not silently re-baselined.
 */
export const EXPECTED = {
  funnel: { pipeline: 3, applied: 13, interviewing: 4, offer: 1, rejected: 3 },
  headline: { totalApplications: 13, totalInterviews: 4, totalOffers: 1, interviewsPer10Apps: 3.1 },
  cold: { applications: 8, interviews: 1, interviewsPer10Apps: 1.3, verdict: "underperforming" as const },
  warm: { applications: 5, interviews: 3, offers: 1, interviewsPer10Apps: 6, verdict: "converting" as const },
  speed: { sampleSize: 13, medianHours: 72, verdict: "slow" as const },
  practice: { sessions: 3, liveSessions: 2, avgScore: 77 },
} as const;
