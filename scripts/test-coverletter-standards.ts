/**
 * Cover letter standards tests - no LLM, no DB.
 * Run: npm run test:coverletter-standards
 */
import type { ProfileFact } from "@/lib/profile/types";
import {
  auditCoverLetterProvenance,
  provenanceViolationsToStrings,
} from "@/lib/coverletter/provenance";
import {
  COVER_LETTER_WORD_COUNT_MAX,
  COVER_LETTER_WORD_COUNT_MIN,
  countWords,
  mentionsCompany,
  mentionsRoleTitle,
  validateCoverLetterStandards,
} from "@/lib/coverletter/standards";

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

const sampleFacts: ProfileFact[] = [
  {
    id: "e1",
    kind: "experience",
    sensitive: false,
    data: {
      title: "Senior Engineer",
      company: "Acme",
      start: "2020",
      end: "Present",
      bullets: ["Grew revenue 35% over two years"],
    },
  },
];

function goodLetter(company: string, role: string): string {
  return `When I led the platform migration at Acme, we grew revenue 35% over two years - the kind of measurable outcome ${company} needs for its ${role} opening.

Your posting emphasizes scalable backend systems, cross-team delivery, and ownership of critical services. At Acme I owned API reliability for three product teams, partnered with infrastructure on capacity planning, and shipped migrations without downtime while keeping error budgets green. I also led design reviews for new endpoints and paired with product managers to scope incremental rollouts that reduced customer-facing risk.

That work maps directly to the distributed services model in your description. I designed rollout plans with feature flags, ran game days before cutovers, and documented runbooks so on-call engineers could resolve incidents quickly. Those practices mirror the operational excellence and customer focus your team describes. I mentored two engineers through their first production launches and established weekly reliability reviews that cut repeat incidents.

Beyond delivery, I contributed to hiring loops and internal documentation that helped new hires ramp in weeks instead of months. I coordinated with security on dependency upgrades and kept service level objectives visible to leadership through concise monthly summaries. I stay aligned with the same facts on my tailored resume - no invented titles or metrics - and I am ready to bring that discipline to ${company}'s platform team.

I am available for a conversation this month and would welcome a brief intro call to discuss how I can contribute to your backend platform and mentor engineers on safe delivery.`;
}

console.log("\nword count & mentions:");
const body = goodLetter("Contoso", "Senior Backend Engineer");
check("countWords matches split length", countWords(body) >= COVER_LETTER_WORD_COUNT_MIN);
check("mentionsCompany true for Contoso", mentionsCompany(body, "Contoso"));
check(
  "mentionsRoleTitle true for Senior Backend Engineer",
  mentionsRoleTitle(body, "Senior Backend Engineer"),
);
check(
  "mentionsRoleTitle false for unrelated title",
  !mentionsRoleTitle(body, "Chief Marketing Officer"),
);

console.log("\nvalidateCoverLetterStandards:");
const report = validateCoverLetterStandards({
  body,
  company: "Contoso",
  jobTitle: "Senior Backend Engineer",
  wordCount: countWords(body),
  openingHook: body.split(/\n\s*\n/)[0],
  keyJdConcepts: ["scalable backend"],
  provenanceOk: true,
  genericnessFlag: false,
});
check("good letter passes critical checks", report.allCriticalPass);
check(
  "company_name check passes",
  report.checks.find((c) => c.id === "company_name")?.passed === true,
);
check(
  "role_title check passes",
  report.checks.find((c) => c.id === "role_title")?.passed === true,
);
check(
  "strong_hook check passes",
  report.checks.find((c) => c.id === "strong_hook")?.passed === true,
);

const genericBody =
  "I am writing to apply for your role. I am passionate about technology and would love to join your team.";
const genericReport = validateCoverLetterStandards({
  body: genericBody,
  company: "Contoso",
  jobTitle: "Senior Backend Engineer",
  wordCount: countWords(genericBody),
});
check("generic letter fails critical checks", !genericReport.allCriticalPass);
check(
  "generic opener fails strong_hook",
  genericReport.checks.find((c) => c.id === "strong_hook")?.passed === false,
);
check(
  "short letter warns on word count",
  genericReport.checks.find((c) => c.id === "word_count")?.severity === "warn",
);
check(
  "passion cliché warns",
  genericReport.checks.find((c) => c.id === "no_passion_cliches")?.passed === false,
);

console.log("\nauditCoverLetterProvenance:");
const grounded = auditCoverLetterProvenance({
  body: "At Acme I grew revenue 35% over two years.",
  usedFactIds: ["e1"],
  allowedFacts: sampleFacts,
});
check("grounded letter provenance ok", grounded.ok === true);

const fabricated = auditCoverLetterProvenance({
  body: "At Acme I grew revenue 90% over two years.",
  usedFactIds: ["e1"],
  allowedFacts: sampleFacts,
});
check("fabricated metric blocks provenance", fabricated.ok === false);
check(
  "fabrication yields block violation string",
  provenanceViolationsToStrings(fabricated).some((v) => v.startsWith("block:")),
);

const unknownId = auditCoverLetterProvenance({
  body: "Did good work.",
  usedFactIds: ["missing"],
  allowedFacts: sampleFacts,
});
check("unknown fact id blocks provenance", unknownId.ok === false);

console.log("\nconstants:");
check(
  "word band is 250-400",
  COVER_LETTER_WORD_COUNT_MIN === 250 && COVER_LETTER_WORD_COUNT_MAX === 400,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
