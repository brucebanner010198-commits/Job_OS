/**
 * Hire-probability feature gate - quality gate, failure modes, readiness, recruiter summary.
 * Run: npm run test:hire-probability
 */
import {
  evaluateQualityGate,
  loadQualityGateConfig,
} from "@/lib/autopilot/quality-gate";
import { mayAutoSubmit } from "@/lib/autopilot/policy";
import {
  FAILURE_MODES,
  failureModesForSignals,
  suggestProfileFixes,
  getFailureMode,
} from "@/lib/candidate/failure-modes";
import { evaluateApplyReadiness } from "@/lib/candidate/apply-readiness";
import { generateRecruiterSummary } from "@/lib/resume/recruiter-summary";
import { scoreScreening } from "@/lib/resume/screening-score";
import { parseRejectionLearning } from "@/lib/track/rejection-learning";
import type { TailoredResume } from "@/lib/resume/schema";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, extra?: string): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${extra ? ` - ${extra}` : ""}`);
  }
}

console.log("\n§QUALITY-GATE");
const cfg = loadQualityGateConfig();
check("config loads min job score", cfg.minJobScore > 0 && cfg.minJobScore <= 1);
check("config loads screening floor", cfg.minScreeningScore >= 50);

const passGate = evaluateQualityGate({
  jobScore: 0.72,
  route: "AUTONOMOUS",
  hardGatePass: true,
  screeningScore: 78,
  exportRecommended: true,
  dailyAutoCount: 0,
});
check("strong scores pass", passGate.verdict === "pass");
check("AUTONOMOUS can auto-submit when pass", passGate.canAutoSubmit === true);

const blockGate = evaluateQualityGate({
  jobScore: 0.35,
  route: "AUTONOMOUS",
  hardGatePass: false,
  screeningScore: 40,
  dailyAutoCount: 0,
});
check("low scores block", blockGate.verdict === "block");
check("blocked cannot auto-submit", blockGate.canAutoSubmit === false);

const reviewGate = evaluateQualityGate({
  jobScore: 0.7,
  route: "ASSISTED",
  hardGatePass: true,
  screeningScore: 80,
});
check("ASSISTED stops at review", reviewGate.verdict === "review");
check("ASSISTED cannot auto-submit", reviewGate.canAutoSubmit === false);
check("policy aligns: ASSISTED not auto", mayAutoSubmit("ASSISTED") === false);

console.log("\n§FAILURE-MODES");
check("catalog has ≥8 modes", FAILURE_MODES.length >= 8);
check("fm-ats-keywords-low exists", getFailureMode("fm-ats-keywords-low") !== undefined);
const modes = failureModesForSignals(["skills", "experience"]);
check("signals map to modes", modes.length >= 1);

const intel = parseRejectionLearning({
  applicationId: "a1",
  company: "Acme",
  role: "Eng",
  category: "REJECTION",
  subject: "Update",
  snippet: "skills required for this role were not demonstrated",
});
check("rejection parses skills signal", intel.signals.includes("skills"));
const fixes = suggestProfileFixes(intel);
check("suggests profile fixes", fixes.length >= 1);

console.log("\n§APPLY-READINESS");
const ready = evaluateApplyReadiness({
  jobScore: 0.68,
  route: "AUTONOMOUS",
  hardGatePass: true,
  jobDescription: "TypeScript React Node.js AWS engineer",
  resumeText: "Built APIs with TypeScript, React, Node.js on AWS.",
});
check("readiness returns status", ["ready", "fix_first", "blocked"].includes(ready.status));
check("readiness has screening percent", ready.screeningPercent >= 0);

const manual = evaluateApplyReadiness({
  jobScore: 0.8,
  route: "MANUAL",
  hardGatePass: true,
  jobDescription: "Engineer",
  resumeText: "Software engineer",
});
check("MANUAL route → fix_first or blocked label", manual.status !== "ready" || manual.label.includes("Manual"));

console.log("\n§RECRUITER-SUMMARY");
const resume: TailoredResume = {
  name: "Jane Doe",
  headline: "Senior Software Engineer",
  contact: { email: "jane@example.com" },
  summary: { text: "Senior engineer with TypeScript and AWS.", sources: ["s1"] },
  experience: [
    {
      title: "Senior Software Engineer",
      company: "Acme",
      start: "01/2020",
      end: "Present",
      bullets: [
        { text: "Reduced latency 40% on AWS microservices.", sources: ["e1"] },
      ],
      sources: ["e1"],
    },
  ],
  education: [],
  skills: [{ name: "Stack", skills: ["TypeScript", "AWS"], sources: ["e1"] }],
  keywordsMatched: ["typescript", "aws"],
  forJobTitle: "Senior Software Engineer",
  forCompany: "BigCo",
};
const screening = scoreScreening({
  resume,
  jobDescription: "Senior Software Engineer TypeScript AWS",
});
const summary = generateRecruiterSummary({ resume, screening });
check("summary has 3 lines", summary.fitLine.length > 0 && summary.proofLine.length > 0);
check("threeLines joined", summary.threeLines.split("\n").length === 3);
check(
  "likelihood enum",
  ["strong", "moderate", "weak"].includes(summary.interviewLikelihood),
);

console.log(`\nhire-probability ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
