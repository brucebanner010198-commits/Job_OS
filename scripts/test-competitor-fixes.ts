/**
 * Competitor-inspired fixes validation gate.
 * Run: npm run test:competitor-fixes
 */
import { previewRouteFromJob, deriveSurface } from "@/lib/pipeline/route-preview";
import { computeAtsMatch, extractJdKeywords } from "@/lib/scoring/ats-keywords";
import {
  parseRejectionLearning,
  explainRejection,
  type RejectionIntel,
} from "@/lib/track/rejection-learning";

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

console.log("§ROUTE-PREVIEW");
check(
  "dice surface → AUTONOMOUS preview",
  previewRouteFromJob({ source: "dice" }) === "AUTONOMOUS",
);
check(
  "linkedin surface → MANUAL preview",
  previewRouteFromJob({ source: "linkedin-feed" }) === "MANUAL",
);
check(
  "greenhouse URL → ASSISTED preview",
  previewRouteFromJob({
    source: "remotive",
    url: "https://boards.greenhouse.io/acme/jobs/123",
  }) === "ASSISTED",
);
check(
  "deriveSurface reads atsType",
  deriveSurface({ source: "x", atsType: "Workday" }) === "workday",
);

console.log("\n§ATS-KEYWORDS");
const jd =
  "Senior TypeScript engineer with React, Node.js, PostgreSQL, and AWS experience required.";
const resume = "Built APIs with TypeScript, React, and PostgreSQL on AWS.";
const match = computeAtsMatch(jd, resume);
check("match percent in 0–100", match.matchPercent >= 0 && match.matchPercent <= 100);
check("matched includes typescript", match.matched.includes("typescript"));
check("gaps excludes matched terms", !match.gaps.includes("typescript"));
check("extractJdKeywords returns bounded list", extractJdKeywords(jd).length <= 40);

console.log("\n§REJECTION-LEARNING");
const intel: RejectionIntel = parseRejectionLearning({
  applicationId: "app-1",
  company: "Acme",
  role: "Staff Eng",
  category: "REJECTION",
  subject: "Update on your application",
  snippet: "We decided to move forward with other candidates who more closely match the experience required.",
});
check("parses other candidates signal", intel.signals.includes("other candidates"));
check("emits targeting suggestion", intel.suggestions.some((s) => s.kind === "targeting"));
const emptyIntel = parseRejectionLearning({
  applicationId: "app-2",
  company: "Beta",
  role: "Eng",
  category: "REJECTION",
  subject: "Thanks for your interest",
  snippet: "We will keep your resume on file.",
});
check("generic fallback when no signals", emptyIntel.suggestions.length >= 1);

const explained = explainRejection(
  "We decided to move forward with other candidates who more closely match the experience required.",
);
check("explainRejection fit category", explained.categories.includes("fit"));
check("explainRejection has fixes", explained.fixes.length >= 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
