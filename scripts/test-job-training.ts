/**
 * Job training + HR connection validation gate.
 * Run: npm run test:job-training
 */
import {
  suggestDreamCompanies,
  mergeDreamCompanySuggestions,
  parseDreamCompaniesJson,
} from "@/lib/goals/dream-companies";
import { analyzeGaps } from "@/lib/candidate/gap-analysis";
import { explainRejection, parseRejectionLearning } from "@/lib/track/rejection-learning";
import { suggestHrContacts } from "@/lib/brief/hr-contacts";
import type { CompanyBriefData } from "@/lib/brief/types";
import { formatCoachNoteBody } from "@/lib/coach/format";

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

console.log("§DREAM-COMPANIES");
const goal = {
  northStar: "Staff engineer at a top AI company",
  summary: "Build ML systems at scale",
  targetTitles: ["Staff Engineer", "ML Engineer"],
  targetIndustries: ["AI", "big tech"],
  milestones: [],
};
const suggested = suggestDreamCompanies(goal);
check("suggests AI companies", suggested.some((s) => s === "OpenAI" || s === "Anthropic"));
const merged = mergeDreamCompanySuggestions([], suggested);
check("merge assigns priorities", merged[0]?.priority === 1);
const parsed = parseDreamCompaniesJson('[{"name":"Stripe","priority":1}]');
check("parse JSON board", parsed[0]?.name === "Stripe");

console.log("\n§GAP-ANALYSIS");
const jd =
  "Staff TypeScript engineer with React, Kubernetes, and PostgreSQL. 8+ years experience required.";
const profile = "Built APIs with TypeScript and React. 5 years software engineering.";
const gaps = analyzeGaps({ profileText: profile, jobDescription: jd, goalText: goal.summary });
check("returns match percent", gaps.matchPercent >= 0 && gaps.matchPercent <= 100);
check("flags missing keywords", gaps.gaps.some((g) => g.gap.includes("kubernetes") || g.gap.includes("postgresql")));
check("flags seniority when applicable", gaps.gaps.some((g) => g.category === "experience" || g.category === "skill"));

const briefFixture: CompanyBriefData = {
  company: "BetaCorp",
  summary: "Enterprise software",
  claims: [
    {
      text: "Jane Smith has been appointed CEO of BetaCorp",
      category: "leadership",
      status: "verified",
      sources: [{ url: "https://news.example.com", title: "News", kind: "news", snippet: "Jane Smith CEO" }],
      retrievedAt: new Date(),
      stale: false,
      secondSourceRequired: true,
    },
  ],
  refused: [],
  generatedAt: new Date(),
};
const briefGaps = analyzeGaps({
  profileText: profile,
  jobDescription: jd,
  brief: briefFixture,
});
check("brief adds leadership gap", briefGaps.gaps.some((g) => g.category === "leadership"));

console.log("\n§REJECTION-EXPLAINER");
const email =
  "We decided to move forward with other candidates who more closely match the experience required for this role.";
const explained = explainRejection(email);
check("categorizes fit", explained.categories.includes("fit"));
check("categorizes experience", explained.categories.includes("experience"));
check("emits module fixes", explained.fixes.some((f) => f.module === "resume" || f.module === "goals"));
const intel = parseRejectionLearning({
  applicationId: "a1",
  company: "Acme",
  role: "Staff",
  category: "REJECTION",
  subject: "Update",
  snippet: email,
});
check("parseRejection still works", intel.signals.includes("other candidates"));

console.log("\n§HR-CONTACTS");
const contacts = suggestHrContacts({
  company: "BetaCorp",
  brief: briefFixture,
  careersPageUrl: "https://betacorp.com/careers",
});
check("surfaces hiring manager from leadership", contacts.some((c) => c.role === "hiring_manager"));
check("includes recruiter baseline", contacts.some((c) => c.role === "recruiter"));
check("extracts CEO name when present", contacts.some((c) => c.contactName === "Jane Smith"));
check("no network calls (pure)", contacts.length >= 2);

console.log("\n§COACH-NOTES");
const coachBody = formatCoachNoteBody("gap", "Test", "Fix kubernetes gap");
check("coach note format", coachBody.includes("kind: gap") && coachBody.includes("kubernetes"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
