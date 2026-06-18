/**
 * Recruiter skim layout tests - no LLM, no DB.
 * Run: npm run test:resume-skim
 */
import { auditProvenance, type SourceEntry } from "@/lib/resume/provenance";
import type { TailoredResume } from "@/lib/resume/schema";
import { renderResumeHtml } from "@/lib/resume/render";
import {
  applySkimLayout,
  computeSkimZone,
} from "@/lib/resume/skim-layout";
import { scoreScreening } from "@/lib/resume/screening-score";

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

function baseResume(
  bullets: { text: string; sources: string[] }[],
): TailoredResume {
  return {
    name: "Jane Doe",
    headline: "Senior Software Engineer",
    contact: { email: "jane@example.com" },
    summary: {
      text: "Senior engineer shipping measurable impact on backend systems.",
      sources: ["s1"],
    },
    experience: [
      {
        title: "Software Engineer",
        company: "Acme",
        start: "01/2020",
        end: "Present",
        bullets,
        sources: ["e1"],
      },
    ],
    education: [],
    skills: [
      { name: "Languages", skills: ["TypeScript", "Python"], sources: ["e1"] },
      { name: "Cloud", skills: ["AWS"], sources: ["e1"] },
    ],
    keywordsMatched: ["typescript", "aws"],
    forJobTitle: "Senior Software Engineer",
    forCompany: "BigCo",
  };
}

console.log("\napplySkimLayout - bullet reorder:");
const unordered = baseResume([
  { text: "Collaborated with cross-functional teams on platform work.", sources: ["e1"] },
  { text: "Increased revenue 35% by launching a new pricing tier.", sources: ["e1"] },
  { text: "Maintained CI pipelines for the monorepo.", sources: ["e1"] },
]);
const skimmed = applySkimLayout(unordered);
check(
  "metric bullet moves to first position",
  skimmed.resume.experience[0]!.bullets[0]!.text.includes("35%"),
);
check(
  "strongestMetric captured",
  skimmed.strongestMetric?.text.includes("35%") === true,
);

console.log("\napplySkimLayout - skill reorder:");
const skillsFirst = skimmed.resume.skills[0]!.name;
check(
  "JD-matched skill group surfaces first",
  skillsFirst === "Languages" || skillsFirst === "Cloud",
);

console.log("\ncomputeSkimZone:");
const zone = computeSkimZone(skimmed.resume);
check("zone includes summary", zone.includesSummary);
check("zone maps top bullets", zone.experienceBullets.length >= 1);
check(
  "first bullet in zone is index 0",
  zone.experienceBullets[0]?.bulletIndex === 0,
);

console.log("\nprovenance preserved after skim reorder:");
const sources: SourceEntry[] = [
  { id: "e1", text: "Increased revenue 35% at Acme" },
  { id: "s1", text: "Senior engineer background" },
];
const before = auditProvenance(unordered, sources);
const after = auditProvenance(skimmed.resume, sources);
check("provenance ok before skim", before.ok);
check("provenance ok after skim", after.ok);

console.log("\nrenderResumeHtml skim highlight:");
const html = renderResumeHtml(skimmed.resume, { highlightSkim: zone });
check("skim legend rendered", html.includes("Recruiter skim preview"));
check("skim-zone class on header", html.includes('class="hdr skim-zone"'));
check("skim-zone on metric bullet", html.includes('<li class="skim-zone">'));

console.log("\nscreening improves after metric-first reorder:");
const jd = "Senior Software Engineer TypeScript AWS revenue growth";
const beforeScore = scoreScreening({ resume: unordered, jobDescription: jd });
const afterScore = scoreScreening({ resume: skimmed.resume, jobDescription: jd });
check(
  "metrics in top fold same or better",
  afterScore.skim.metricsInTopFold >= beforeScore.skim.metricsInTopFold,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
