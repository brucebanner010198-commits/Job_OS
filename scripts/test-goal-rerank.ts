/**
 * Career-goals validation gate (plan §7): goals must MEASURABLY re-rank job
 * matches, or they're decoration and we'd trim them. No LLM, no DB - pure,
 * deterministic scoring. Run: npx tsx scripts/test-goal-rerank.ts
 */
import {
  goalAwareRelevance,
  axisSimilarity,
  tokenSet,
} from "@/lib/scoring/relevance";
import { goalText, type CareerGoalData } from "@/lib/goals/types";
import { SAMPLE_ROLES } from "@/lib/scoring/sample-roles";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

/** Rank sample roles by goal-aware relevance against a given resume + goal. */
function rank(resumeText: string, goal: CareerGoalData): string[] {
  const axis = goalText(goal);
  return [...SAMPLE_ROLES]
    .map((r) => ({
      title: r.title,
      score: goalAwareRelevance(r.text, { resumeText, goalText: axis }).relevance,
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.title);
}

// A backend IC's history - same for both goal sets, so any re-rank is the
// goals talking, not the resume.
const resume =
  "Senior backend engineer. Built high-throughput services in Go and Postgres. " +
  "APIs, latency, reliability, on-call, distributed systems, scalability.";

const managerGoal: CareerGoalData = {
  northStar: "VP of Engineering",
  summary: "Move from individual contributor into people leadership and grow an org.",
  targetTitles: ["Engineering Manager", "Director of Engineering"],
  targetIndustries: ["fintech"],
  milestones: [
    { horizon: "SIX_MONTHS", text: "Start managing a small backend team" },
    { horizon: "ONE_YEAR", text: "Own hiring and mentorship for the team" },
    { horizon: "TWO_YEARS", text: "Lead a platform org" },
    { horizon: "THREE_YEARS", text: "Director of Engineering" },
    { horizon: "FOUR_YEARS", text: "Run multiple teams" },
    { horizon: "FIVE_YEARS", text: "Senior engineering leadership" },
    { horizon: "TEN_YEARS", text: "VP of Engineering" },
  ],
};

const mlGoal: CareerGoalData = {
  northStar: "Principal Machine Learning Engineer",
  summary: "Go deep technical: train and deploy models and LLM applications.",
  targetTitles: ["Machine Learning Engineer", "Staff Software Engineer"],
  targetIndustries: ["climate", "AI"],
  milestones: [
    { horizon: "SIX_MONTHS", text: "Ship an ML model and data pipeline" },
    { horizon: "ONE_YEAR", text: "Build LLM applications with retrieval and evaluation" },
    { horizon: "TWO_YEARS", text: "Own inference infrastructure" },
    { horizon: "THREE_YEARS", text: "Staff-level technical leadership" },
    { horizon: "FOUR_YEARS", text: "Drive ML architecture" },
    { horizon: "FIVE_YEARS", text: "Principal engineer" },
    { horizon: "TEN_YEARS", text: "Set ML technical direction" },
  ],
};

console.log("\ntokenization sanity:");
check("stopwords dropped, terms kept", !tokenSet("the team").has("the") && tokenSet("Postgres latency").has("postgres"));
check("tech tokens with symbols survive", tokenSet("Go, C++ and Node.js").has("c++"));

console.log("\nresume-only baseline (no goals):");
const blank: CareerGoalData = {
  northStar: "",
  summary: "",
  targetTitles: [],
  targetIndustries: [],
  milestones: [],
};
const baseline = rank(resume, blank);
console.log("   ", baseline.join("  >  "));
check("backend IC ranks Senior Backend Engineer at the top", baseline[0] === "Senior Backend Engineer");

console.log("\nwith a MANAGER goal:");
const managerRank = rank(resume, managerGoal);
console.log("   ", managerRank.join("  >  "));
// Under max(resume, goals), goals RESCUE roles history buries - they rise.
check(
  "Engineering Manager rises vs the resume-only baseline",
  managerRank.indexOf("Engineering Manager") < baseline.indexOf("Engineering Manager"),
);
check(
  "Engineering Manager outranks the unrelated Product Manager role",
  managerRank.indexOf("Engineering Manager") < managerRank.indexOf("Product Manager, Platform"),
);

console.log("\nwith an ML goal:");
const mlRank = rank(resume, mlGoal);
console.log("   ", mlRank.join("  >  "));
check(
  "Machine Learning Engineer jumps to the top",
  mlRank[0] === "Machine Learning Engineer",
);
check(
  "Machine Learning Engineer outranks Engineering Manager",
  mlRank.indexOf("Machine Learning Engineer") < mlRank.indexOf("Engineering Manager"),
);

console.log("\nthe core claim - goals re-rank:");
check(
  "manager and ML goals produce DIFFERENT rankings from the same resume",
  managerRank.join("|") !== mlRank.join("|"),
);
check(
  "manager goal differs from the resume-only baseline",
  managerRank.join("|") !== baseline.join("|"),
);

console.log("\nexplainability:");
const mgrEng = goalAwareRelevance(
  SAMPLE_ROLES.find((r) => r.title === "Engineering Manager")!.text,
  { resumeText: resume, goalText: goalText(managerGoal) },
);
check("manager role is driven by goals, not history", mgrEng.drivenBy === "goals");
check("a pure backend role stays driven by history", (() => {
  const r = goalAwareRelevance(
    SAMPLE_ROLES.find((x) => x.title === "Senior Backend Engineer")!.text,
    { resumeText: resume, goalText: goalText(managerGoal) },
  );
  return r.drivenBy === "resume" || r.drivenBy === "both";
})());

console.log("\nempty-axis safety:");
check("empty job text scores 0", axisSimilarity("", resume) === 0);
check("empty axis scores 0", axisSimilarity("backend engineer", "") === 0);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
