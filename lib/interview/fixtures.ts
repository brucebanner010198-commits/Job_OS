/**
 * Deterministic fixtures for the interview-prep brains (Phase 8). The whole
 * corpus is offline and clock-free: a constant FIXTURE_NOW is injected wherever
 * time is needed, so nothing depends on the wall clock. These drive both the
 * brain self-checks and the integration gate (scripts/test-interview.ts), and the
 * MOCK_SCRIPT powers the fixture voice source + offline page preview.
 */

import type {
  DailyUsage,
  MockScript,
  PrepInput,
  ProfileFact,
  TranscriptTurn,
} from "@/lib/interview/types";

/** The single injected "now" - a fixed instant; never read the system clock. */
export const FIXTURE_NOW = "2026-06-16T12:00:00.000Z";

// --- Profile facts (Bruce Banner, Backend Engineer) --------------------------
// Concrete, quantified facts so STAR answers can be grounded with real
// specifics. One LIFE_FACT is `sensitive: true` - it must NEVER appear in a
// guide, a persona prompt, or a transcript, and the study brain must withhold it.

export const fixtureFacts: ProfileFact[] = [
  {
    id: "exp-acme",
    kind: "EXPERIENCE",
    text: "Led the payments platform rewrite at Acme, cutting checkout latency 40% and unblocking international launch.",
    sensitive: false,
  },
  {
    id: "exp-billing",
    kind: "EXPERIENCE",
    text: "Owned the billing service handling $20M/year in transactions with 99.99% uptime.",
    sensitive: false,
  },
  {
    id: "proj-webhooks",
    kind: "PROJECT",
    text: "Built an idempotent webhook pipeline processing 5M events/day with exactly-once delivery.",
    sensitive: false,
  },
  {
    id: "ach-oncall",
    kind: "ACHIEVEMENT",
    text: "Reduced on-call incidents 60% by introducing circuit breakers and load-shedding.",
    sensitive: false,
  },
  {
    id: "ach-mentor",
    kind: "ACHIEVEMENT",
    text: "Mentored 4 junior engineers; 2 were promoted within a year.",
    sensitive: false,
  },
  {
    id: "skill-stack",
    kind: "SKILL",
    text: "Go, PostgreSQL, Kafka, gRPC, and distributed-systems design.",
    sensitive: false,
  },
  {
    id: "skill-arch",
    kind: "SKILL",
    text: "Event-driven architecture and high-throughput API design.",
    sensitive: false,
  },
  // SENSITIVE - must be withheld from every answer, prompt, and transcript.
  {
    id: "life-health",
    kind: "LIFE_FACT",
    text: "Has two young children and manages a chronic health condition.",
    sensitive: true,
  },
];

// --- Prep inputs -------------------------------------------------------------
// Aligned to companies that exist in the tracker / warm fixtures so the board
// shows coherent, cross-module data. `expectGrounded` is the ground truth for the
// extractive guard: a prep with real facts must produce a grounded guide.

export interface FixturePrep {
  prep: PrepInput;
  expectGrounded: boolean;
  /** Auto-surfaced by a Gmail interview invite (drives the board's fromInvite). */
  fromInvite: boolean;
}

export const fixturePreps: FixturePrep[] = [
  {
    prep: {
      company: "Stripe",
      role: "Backend Engineer",
      jobDescription:
        "Design and operate high-throughput payment APIs. Strong distributed-systems and reliability background required; Go and PostgreSQL a plus.",
      facts: fixtureFacts,
      applicationId: "app-stripe",
    },
    expectGrounded: true,
    fromInvite: true,
  },
  {
    prep: {
      company: "Vercel",
      role: "Platform Engineer",
      jobDescription:
        "Own developer-facing platform services. Care about latency, reliability, and great APIs.",
      facts: fixtureFacts,
      applicationId: "app-vercel",
    },
    expectGrounded: true,
    fromInvite: false,
  },
  // A bare prep with NO facts - the guide must still emit questions but flag
  // provenanceOk=false (nothing real to ground the model answers in).
  {
    prep: {
      company: "Datadog",
      role: "Software Engineer",
      jobDescription: "Build observability tooling at scale.",
      facts: [],
      applicationId: "app-datadog",
    },
    expectGrounded: false,
    fromInvite: false,
  },
];

/** Convenience: the primary grounded prep used across several checks. */
export const fixturePrep: PrepInput = fixturePreps[0].prep;

// --- Daily usage (kill-switch) -----------------------------------------------
// Defaults: dailyCapSec = 3600. `under` leaves budget; `atCap` is exactly spent;
// `over` exceeds - both must block a new live session.

export const fixtureUsageUnder: DailyUsage = {
  day: "2026-06-16",
  secondsUsed: 600,
  sessions: 1,
};
export const fixtureUsageAtCap: DailyUsage = {
  day: "2026-06-16",
  secondsUsed: 3600,
  sessions: 3,
};
export const fixtureUsageOver: DailyUsage = {
  day: "2026-06-16",
  secondsUsed: 4200,
  sessions: 4,
};
/** No usage yet today - a session may start with the full per-session budget. */
export const fixtureUsageFresh: DailyUsage = {
  day: "2026-06-16",
  secondsUsed: 0,
  sessions: 0,
};

// --- Transcripts (for the scorer) --------------------------------------------
// A STRONG answer: STAR-ordered, concrete numbers + proper nouns, ties to role.
// A WEAK answer: rambling, filler, no metrics, no structure. The scorer must
// rank strong >> weak on structure + specificity, deterministically.

export const fixtureStrongTranscript: TranscriptTurn[] = [
  {
    role: "interviewer",
    text: "Tell me about a time you improved the reliability of a system.",
    atSec: 0,
  },
  {
    role: "candidate",
    text: "At Acme our checkout was timing out under load - that was the situation. My task was to cut latency and stop the incidents. I led a rewrite of the payments platform: I introduced circuit breakers and load-shedding and rebuilt the billing service. As a result checkout latency dropped 40% and on-call incidents fell 60%, which unblocked our international launch.",
    atSec: 12,
  },
  {
    role: "interviewer",
    text: "How did you handle exactly-once delivery in that pipeline?",
    atSec: 70,
  },
  {
    role: "candidate",
    text: "I built an idempotent webhook pipeline on Kafka processing 5 million events a day. Each event carried an idempotency key persisted in PostgreSQL, so retries were safe and we guaranteed exactly-once handling downstream.",
    atSec: 82,
  },
];

export const fixtureWeakTranscript: TranscriptTurn[] = [
  {
    role: "interviewer",
    text: "Tell me about a time you improved the reliability of a system.",
    atSec: 0,
  },
  {
    role: "candidate",
    text: "Um, yeah, so, I mean, I've done a lot of stuff with reliability I guess. Like, we had some issues and basically I just sort of fixed them over time, you know? It was good. I think it went well overall, kind of.",
    atSec: 9,
  },
  {
    role: "interviewer",
    text: "Can you give a specific example with the impact?",
    atSec: 40,
  },
  {
    role: "candidate",
    text: "Honestly it's hard to remember exactly. There were a bunch of things. We made it better. People were happy I think.",
    atSec: 48,
  },
];

// --- Mock script (fixture voice source + offline preview) --------------------
// A short scripted live session the UI plays when no API key is configured, so
// the entire flow - opener → Q/A turn-taking → transcript → score - is
// demonstrable at zero cost.

export const MOCK_SCRIPT: MockScript = {
  turns: [
    {
      role: "interviewer",
      text: "Thanks for joining. To start, walk me through a project you're proud of.",
      atSec: 0,
    },
    {
      role: "candidate",
      text: "At Acme I led the payments platform rewrite. The situation was checkout timing out under load; my task was to cut latency. I introduced circuit breakers and rebuilt the billing service, and as a result latency dropped 40%.",
      atSec: 8,
    },
    {
      role: "interviewer",
      text: "What was the hardest trade-off you made there?",
      atSec: 55,
    },
    {
      role: "candidate",
      text: "Choosing exactly-once delivery over raw throughput. I kept an idempotency key in PostgreSQL so retries were safe, which cost a little latency but eliminated double charges.",
      atSec: 63,
    },
    {
      role: "interviewer",
      text: "Last one - why this team?",
      atSec: 110,
    },
    {
      role: "candidate",
      text: "I want to work on high-throughput payment APIs where reliability is the product, which is exactly what this role is about.",
      atSec: 118,
    },
    {
      role: "interviewer",
      text: "Great, that's all from me. We'll be in touch about next steps.",
      atSec: 150,
    },
  ],
};
