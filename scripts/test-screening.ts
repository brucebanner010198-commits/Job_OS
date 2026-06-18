/**
 * ATS + 6-second skim screening tests - no LLM, no DB.
 * Run: npm run test:screening
 */
import {
  ATS,
  findKeywordStuffing,
  hasMetricSignal,
  isAtsDate,
  screeningPromptBlock,
} from "@/lib/resume/ats-rules";
import { scoreScreening } from "@/lib/resume/screening-score";
import type { TailoredResume } from "@/lib/resume/schema";

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

const JD = `
Senior Software Engineer - TypeScript, React, Node.js, PostgreSQL, AWS.
Build scalable APIs, mentor engineers, CI/CD, Kubernetes, microservices.
5+ years experience. Bachelor's degree. Agile, code review, system design.
`.trim();

function sampleResume(overrides: Partial<TailoredResume> = {}): TailoredResume {
  return {
    name: "Jane Doe",
    headline: "Senior Software Engineer",
    contact: { email: "jane@example.com", location: "San Francisco, CA" },
    summary: {
      text: "Senior engineer with TypeScript, React, and AWS experience building scalable APIs.",
      sources: ["s1"],
    },
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Acme Corp",
        start: "03/2021",
        end: "Present",
        bullets: [
          {
            text: "Reduced API latency 40% by redesigning Node.js microservices on AWS.",
            sources: ["e1"],
          },
          {
            text: "Led migration to Kubernetes, cutting deploy time from 2h to 15m for 12 services.",
            sources: ["e1"],
          },
          {
            text: "Mentored 4 engineers on TypeScript, React, and PostgreSQL best practices.",
            sources: ["e1"],
          },
          {
            text: "Shipped CI/CD pipeline improvements increasing release frequency 3x.",
            sources: ["e1"],
          },
        ],
        sources: ["e1"],
      },
    ],
    education: [
      {
        degree: "B.S. Computer Science",
        institution: "State University",
        end: "2018",
        sources: ["ed1"],
      },
    ],
    skills: [
      {
        name: "Technical",
        skills: [
          "TypeScript",
          "React",
          "Node.js",
          "PostgreSQL",
          "AWS",
          "Kubernetes",
        ],
        sources: ["e1"],
      },
    ],
    forJobTitle: "Senior Software Engineer",
    forCompany: "BigCo",
    ...overrides,
  };
}

console.log("\nats-rules helpers:");
check("isAtsDate accepts MM/YYYY", isAtsDate("03/2021"));
check("isAtsDate accepts Present", isAtsDate("Present"));
check("isAtsDate rejects year-only", !isAtsDate("2021"));
check("hasMetricSignal finds 40%", hasMetricSignal("cut latency 40%"));
check("hasMetricSignal finds $2m", hasMetricSignal("managed $2m budget"));
check(
  "findKeywordStuffing flags repeat term",
  findKeywordStuffing("typescript typescript typescript typescript").includes(
    "typescript",
  ),
);
check(
  "screeningPromptBlock mentions headline",
  screeningPromptBlock("mid", "Staff Engineer").includes("Staff Engineer"),
);

console.log("\nscoreScreening - strong tailored resume:");
const strong = scoreScreening({ resume: sampleResume(), jobDescription: JD });
check("strong overall >= 60", strong.overall >= 60);
check("strong headline aligned", strong.skim.headlineAligned);
check(
  "strong metrics in top fold",
  strong.skim.metricsInTopFold >= 2,
);
check("strong passes skim", strong.passesSkim);
check(
  "strong keyword match > 0",
  strong.keywordMatchPercent > 0,
);

console.log("\nscoreScreening - weak headline:");
const weakHeadline = scoreScreening({
  resume: sampleResume({
    headline: "Software Professional",
    forJobTitle: "Senior Software Engineer",
  }),
  jobDescription: JD,
});
check("misaligned headline flagged", !weakHeadline.skim.headlineAligned);
check(
  "misaligned headline has block flag",
  weakHeadline.redFlags.some((f) => f.ruleId === "skim-headline-match"),
);
check("misaligned fails skim", !weakHeadline.passesSkim);

console.log("\nscoreScreening - bad dates:");
const badDates = scoreScreening({
  resume: sampleResume({
    experience: [
      {
        ...sampleResume().experience[0]!,
        start: "2021",
        end: "Present",
      },
    ],
  }),
  jobDescription: JD,
});
check(
  "bad dates produce struct-mm-yyyy flag",
  badDates.redFlags.some((f) => f.ruleId === "struct-mm-yyyy"),
);

console.log("\nscoreScreening - keyword stuffing:");
const stuffedText = Array(5)
  .fill("typescript react node postgresql aws kubernetes microservices")
  .join(" ");
const stuffed = scoreScreening({
  resume: sampleResume({
    summary: { text: stuffedText, sources: ["s1"] },
  }),
  jobDescription: JD,
});
check(
  "stuffing triggers kw-no-stuffing",
  stuffed.redFlags.some((f) => f.ruleId === "kw-no-stuffing"),
);

console.log("\nscoreScreening - generic vs tailored keyword gap:");
const genericJd = "Quantum physicist, particle accelerator, cryogenics.";
const tailored = scoreScreening({
  resume: sampleResume(),
  jobDescription: JD,
});
const generic = scoreScreening({
  resume: sampleResume(),
  jobDescription: genericJd,
});
check(
  "tailored JD scores higher than unrelated JD",
  tailored.keywordMatchPercent > generic.keywordMatchPercent,
);

console.log("\nATS thresholds documented:");
check(
  "keyword pass threshold is 70",
  ATS.keywordMatchPassPercent === 70,
);
check("top fold expects 4 metric bullets", ATS.topFoldMetricBullets === 4);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
