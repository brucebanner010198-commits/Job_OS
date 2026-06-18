/**
 * Phase 3 scoring validation gate.
 *
 * Proves deterministically (no LLM, no DB, no network):
 *   1. Hard gate caps an under-qualified candidate.
 *   2. An UNKNOWN fact does NOT trigger a cap.
 *   3. Reachability is lower for a big reach-up than for a lateral match.
 *   4. Recency is an additive TIEBREAKER - never a multiplier.
 *   5. relevanceDriver propagates correctly to ScoredJob.
 *   6. ScoreExplain is fully populated where expected.
 *
 * Run: npx tsx scripts/test-scoring.ts
 */
import { scoreJob, recencyBonus, RECENCY_MAX, RELEVANCE_WEIGHT, REACHABILITY_WEIGHT } from "@/lib/scoring/score";
import { hardGate, HARD_GATE_CEILING, parseJobRequirements } from "@/lib/scoring/hard-gate";
import { reachability } from "@/lib/scoring/reachability";
import type { ScoreInput, HardFacts } from "@/lib/jobs/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// -- Shared fixtures ---------------------------------------------------------

const now = new Date("2024-06-01T12:00:00Z");
const oneHourAgo = new Date("2024-06-01T11:00:00Z");
const twoHoursAgo = new Date("2024-06-01T10:00:00Z");
const thirtyDaysAgo = new Date("2024-05-02T12:00:00Z");

/** A JD for a very senior role that requires 10+ years. */
const seniorJD = [
  "Principal Software Engineer.",
  "We require 10+ years of experience in software engineering.",
  "Expert in TypeScript, React, Node.js, distributed systems, microservices.",
  "Bachelor's degree required.",
  "Strong background in system architecture and technical leadership.",
].join(" ");

/** Resume that is highly relevant to the senior JD (many matching tokens). */
const matchingResume = [
  "Software engineer with deep TypeScript, React, Node.js experience.",
  "Built distributed systems and microservices architecture.",
  "Strong background in backend technical leadership.",
].join(" ");

const sharedGoals = "TypeScript React Node.js distributed systems engineer.";
const sharedProfile = "TypeScript React Node.js distributed systems engineer.";

function makeInput(overrides: Partial<ScoreInput> & { hardFacts: HardFacts }): ScoreInput {
  return {
    jobText: seniorJD,
    resumeText: matchingResume,
    goalText: sharedGoals,
    profileText: sharedProfile,
    firstSeenAt: thirtyDaysAgo,
    now,
    ...overrides,
  };
}

// -- 1. Hard gate caps an under-qualified candidate ---------------------------
console.log("\n1. Hard gate - under-qualified candidate (3 years vs 10+ required):");

const underQualified = scoreJob(
  makeInput({ hardFacts: { yearsExperience: 3 } }),
);
check("hardGatePass is false", underQualified.hardGatePass === false);
check(
  "score ≤ HARD_GATE_CEILING + RECENCY_MAX",
  underQualified.score <= HARD_GATE_CEILING + RECENCY_MAX,
);
check(
  "caps array is non-empty",
  underQualified.explain.caps.length > 0,
);
check(
  "cap reason mentions required years (10)",
  underQualified.explain.caps.some((c) => c.reason.includes("10")),
);
check(
  "cap reason mentions candidate years (3)",
  underQualified.explain.caps.some((c) => c.reason.includes("3")),
);

// -- 2. Unknown fact does NOT cap ---------------------------------------------
console.log("\n2. Hard gate - unknown years of experience (no cap expected):");

const unknownYears = scoreJob(
  makeInput({ hardFacts: {} }),
);
check("hardGatePass is true when yearsExperience is undefined", unknownYears.hardGatePass === true);
check("caps array is empty", unknownYears.explain.caps.length === 0);
check(
  "score is not capped (score > HARD_GATE_CEILING)",
  unknownYears.score > HARD_GATE_CEILING,
);

// Also verify directly with hardGate helper:
const gateDirectUnknown = hardGate({ jobText: seniorJD, hardFacts: {} });
check("direct hardGate: pass=true for empty hardFacts", gateDirectUnknown.pass === true);

const gateDirectKnown = hardGate({ jobText: seniorJD, hardFacts: { yearsExperience: 3 } });
check("direct hardGate: pass=false for 3 years vs 10+", gateDirectKnown.pass === false);

// -- 3. Reachability - big reach-up vs lateral --------------------------------
console.log("\n3. Reachability - junior vs principal/staff (reach-up) vs junior vs junior (lateral):");

const principalJD =
  "Principal Staff Software Engineer. " +
  "Principal-level technical architecture, design, and leadership. " +
  "Drive principal decisions across multiple teams.";

const juniorJD =
  "Junior Software Engineer, entry-level position. " +
  "Learning TypeScript JavaScript fundamentals. " +
  "Collaborative team environment for new graduates.";

const juniorProfile =
  "Junior developer, entry-level software engineer. " +
  "Learning TypeScript JavaScript React basics.";

const reachUp = reachability({ jobText: principalJD, profileText: juniorProfile });
const lateral = reachability({ jobText: juniorJD, profileText: juniorProfile });

console.log(`     reach-up value: ${reachUp.value.toFixed(3)}, lateral value: ${lateral.value.toFixed(3)}`);
console.log(`     reach-up notes: ${reachUp.notes.join("; ")}`);
check(
  "reach-up reachability < lateral reachability",
  reachUp.value < lateral.value,
);
check(
  "reach-up notes mention level gap",
  reachUp.notes.some((n) => n.includes("reach up")),
);
check(
  "lateral notes mention lateral or step-down",
  lateral.notes.some((n) => n.includes("lateral") || n.includes("step-down")),
);

// -- 4. Recency is a TIEBREAKER, not a multiplier ----------------------------
console.log("\n4. Recency tiebreaker:");

// 4a. Same job, fresh vs old → fresh ranks first.
const freshScore = scoreJob(makeInput({ hardFacts: {}, firstSeenAt: oneHourAgo }));
const oldScore = scoreJob(makeInput({ hardFacts: {}, firstSeenAt: thirtyDaysAgo }));
check(
  "fresh job (1h old) outranks identical old job (30 days old)",
  freshScore.score > oldScore.score,
);
check(
  "old job recency bonus is 0",
  oldScore.explain.recencyBonus === 0,
);
check(
  "fresh job recency bonus equals RECENCY_MAX",
  freshScore.explain.recencyBonus === RECENCY_MAX,
);

// 4b. Strong old job beats weak fresh job.
const strongOldInput: ScoreInput = {
  // Maximal overlap - same tokens in JD and resume.
  jobText: "typescript react nodejs distributed systems microservices backend architect",
  resumeText: "typescript react nodejs distributed systems microservices backend architect",
  goalText: "typescript react nodejs engineer",
  profileText: "senior typescript react nodejs engineer distributed systems",
  hardFacts: {},
  firstSeenAt: thirtyDaysAgo,
  now,
};
const weakFreshInput: ScoreInput = {
  // Zero overlap - ophthalmology vs backend engineer.
  jobText: "ophthalmologist surgeon medical doctor eye surgery specialist retina clinic",
  resumeText: "typescript react nodejs distributed systems microservices backend architect",
  goalText: "typescript react nodejs engineer",
  profileText: "senior typescript react nodejs engineer distributed systems",
  hardFacts: {},
  firstSeenAt: oneHourAgo,
  now,
};
const strongOld = scoreJob(strongOldInput);
const weakFresh = scoreJob(weakFreshInput);

console.log(`     strong-old score: ${strongOld.score.toFixed(3)}, weak-fresh score: ${weakFresh.score.toFixed(3)}`);
check(
  "strong old job outranks weak fresh job",
  strongOld.score > weakFresh.score,
);

// 4c. recencyBonus never exceeds RECENCY_MAX.
const bonusFresh = recencyBonus(oneHourAgo, now);
const bonusTwoH = recencyBonus(twoHoursAgo, now);
const bonusOld = recencyBonus(thirtyDaysAgo, now);
check("bonus at 1h = RECENCY_MAX", bonusFresh === RECENCY_MAX);
check("bonus at 2h = RECENCY_MAX", bonusTwoH === RECENCY_MAX);
check("bonus at 30d = 0", bonusOld === 0);
check("fresh job explain.recencyBonus ≤ RECENCY_MAX", freshScore.explain.recencyBonus <= RECENCY_MAX);
check("RECENCY_MAX constant is small (≤ 0.1)", RECENCY_MAX <= 0.1);

// -- 5. relevanceDriver propagates -------------------------------------------
console.log("\n5. relevanceDriver propagation:");

// JD and goals share many tokens; JD and resume share none.
const mlGoalText =
  "machine learning pytorch deep learning neural networks inference model training ai";
const mlJD =
  "Machine learning engineer role. " +
  "Deep learning, pytorch, neural networks, model training, inference. " +
  "AI model deployment and monitoring.";
const phpResume =
  "Backend PHP developer. MySQL LAMP stack. Enterprise Java monolith applications.";

const goalDrivenScore = scoreJob({
  jobText: mlJD,
  resumeText: phpResume,
  goalText: mlGoalText,
  profileText: "backend php mysql developer",
  hardFacts: {},
  firstSeenAt: thirtyDaysAgo,
  now,
});
console.log(`     drivenBy: ${goalDrivenScore.relevanceDriver}, resume: ${goalDrivenScore.explain.resumeRelevance.toFixed(3)}, goals: ${goalDrivenScore.explain.goalRelevance.toFixed(3)}`);
check(
  "goals-driven job reports relevanceDriver = 'goals'",
  goalDrivenScore.relevanceDriver === "goals",
);
check(
  "goalRelevance > resumeRelevance for goals-driven job",
  goalDrivenScore.explain.goalRelevance > goalDrivenScore.explain.resumeRelevance,
);

// Resume-driven case: JD overlaps resume heavily, goals blank.
const resumeDrivenScore = scoreJob({
  jobText: "TypeScript React Node.js backend engineer distributed systems",
  resumeText: "TypeScript React Node.js backend engineer distributed systems",
  goalText: "",
  profileText: "senior engineer",
  hardFacts: {},
  firstSeenAt: thirtyDaysAgo,
  now,
});
check(
  "resume-driven job reports relevanceDriver = 'resume' or 'both'",
  resumeDrivenScore.relevanceDriver === "resume" ||
    resumeDrivenScore.relevanceDriver === "both",
);

// -- 6. ScoreExplain is fully populated --------------------------------------
console.log("\n6. ScoreExplain fully populated:");

// Craft an input that triggers: skill coverage note, verify-degree note, fresh <24h note.
const explainInput: ScoreInput = {
  jobText: [
    "Senior Software Engineer.",
    "Bachelor's degree required.",
    "5+ years of experience required.",
    "TypeScript Node.js React developer with distributed systems skills.",
  ].join(" "),
  resumeText: "TypeScript Node.js React developer with distributed systems background",
  goalText: "Senior software engineer TypeScript React",
  profileText: "TypeScript Node.js React senior engineer",
  // hardFacts: degree unknown → verify note; yearsExperience unknown → no cap
  hardFacts: {},
  firstSeenAt: oneHourAgo, // fresh → "fresh <24h" note
  now,
};
const explainResult = scoreJob(explainInput);

check("score is a finite number", isFinite(explainResult.score));
check("score is positive", explainResult.score > 0);
check("explain.caps is an array", Array.isArray(explainResult.explain.caps));
check("explain.notes is a non-empty array", explainResult.explain.notes.length > 0);
check(
  "explain.notes contains verify-degree note",
  explainResult.explain.notes.some((n) => n.includes("verify") && n.includes("degree")),
);
check(
  "explain.notes contains fresh <24h note",
  explainResult.explain.notes.some((n) => n.includes("fresh")),
);
check(
  "explain.recencyBonus is a number in [0, RECENCY_MAX]",
  typeof explainResult.explain.recencyBonus === "number" &&
    explainResult.explain.recencyBonus >= 0 &&
    explainResult.explain.recencyBonus <= RECENCY_MAX,
);
check(
  "all numeric explain fields are finite",
  isFinite(explainResult.explain.relevance) &&
    isFinite(explainResult.explain.resumeRelevance) &&
    isFinite(explainResult.explain.goalRelevance) &&
    isFinite(explainResult.explain.reachability),
);
check(
  "explain.relevanceDriver is one of the three valid values",
  ["resume", "goals", "both"].includes(explainResult.explain.relevanceDriver),
);

// Hard-gate caps + ScoreExplain together: degree cap fires when fact is known + unmet.
const degreeCapInput: ScoreInput = {
  jobText: "PhD required in Computer Science. PhD in machine learning or AI.",
  resumeText: "backend engineer master degree typescript",
  goalText: "",
  profileText: "engineer",
  hardFacts: { degree: "bachelor" },
  firstSeenAt: thirtyDaysAgo,
  now,
};
const degreeCapResult = scoreJob(degreeCapInput);
check("PhD required + bachelor known → hardGatePass false", degreeCapResult.hardGatePass === false);
check("degree cap present in explain.caps", degreeCapResult.explain.caps.length > 0);
check(
  "degree cap reason mentions phd",
  degreeCapResult.explain.caps.some((c) => c.reason.toLowerCase().includes("phd")),
);

// -- Module-level exports sanity ----------------------------------------------
console.log("\n7. Module-level exports sanity:");

check("RELEVANCE_WEIGHT + REACHABILITY_WEIGHT = 1.0", RELEVANCE_WEIGHT + REACHABILITY_WEIGHT === 1.0);
check("HARD_GATE_CEILING is in (0, 0.5)", HARD_GATE_CEILING > 0 && HARD_GATE_CEILING < 0.5);
check("RECENCY_MAX is small enough (cannot lift weak job over strong)", RECENCY_MAX < 0.1);

// parseJobRequirements export
const parsed = parseJobRequirements(seniorJD);
check("parseJobRequirements detects minYears=10", parsed.minYears === 10);
check("parseJobRequirements detects minDegree=bachelor", parsed.minDegree === "bachelor");

// -- Summary ------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
