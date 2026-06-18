/**
 * Self-test: Phase 5 knockout evaluation + field plan (plan §8c).
 * Pure, offline, deterministic. Run: npx tsx scripts/test-apply-knockout.ts
 */

import { evaluateKnockouts } from "@/lib/apply/knockout";
import { planFields } from "@/lib/apply/fields";
import type { ApplicationAnswersData } from "@/lib/apply/types";

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

// -- Shared fixtures -----------------------------------------------------------

const contact = {
  name: "Jane Doe",
  email: "jane@example.com",
  phone: "555-1234",
  location: "New York, NY",
};

/** A fully-qualified candidate who passes every gate. */
const goodAnswers: ApplicationAnswersData = {
  workAuthorized: true,
  requiresSponsorship: false,
  yearsExperience: 12,
  hasClearance: true,
  willingToRelocate: true,
  salaryExpectation: 160000,
  noticePeriod: "2 weeks",
  linkedinUrl: "https://linkedin.com/in/janedoe",
  githubUrl: "https://github.com/janedoe",
  websiteUrl: "https://janedoe.com",
  locations: ["New York, NY"],
  customAnswers: [],
};

// -- Knockout: years of experience --------------------------------------------

console.log("\nKnockout - years of experience:");

const yearsJd = "We require 10+ years of experience in software development.";

const shortYearsAnswers: ApplicationAnswersData = { ...goodAnswers, yearsExperience: 3 };
const yearsFailResult = evaluateKnockouts({ jobText: yearsJd, answers: shortYearsAnswers });
check("disqualified: 3 years vs 10+ requirement", yearsFailResult.disqualified === true);
check("failure mentions the required years", yearsFailResult.failures.some((f) => f.requirement.includes("10")));

const okYearsAnswers: ApplicationAnswersData = { ...goodAnswers, yearsExperience: 12 };
const yearsPassResult = evaluateKnockouts({ jobText: yearsJd, answers: okYearsAnswers });
check("NOT disqualified: 12 years vs 10+ requirement", yearsPassResult.disqualified === false);

// -- Knockout: work authorization / sponsorship --------------------------------

console.log("\nKnockout - work authorization / sponsorship:");

const authJd =
  "Candidates must be authorized to work in the US without sponsorship.";

const noAuthAnswers: ApplicationAnswersData = { ...goodAnswers, workAuthorized: false };
const noAuthResult = evaluateKnockouts({ jobText: authJd, answers: noAuthAnswers });
check("disqualified: workAuthorized=false on no-sponsorship JD", noAuthResult.disqualified === true);

const sponsorAnswers: ApplicationAnswersData = {
  ...goodAnswers,
  workAuthorized: true,
  requiresSponsorship: true,
};
const sponsorResult = evaluateKnockouts({ jobText: authJd, answers: sponsorAnswers });
check("disqualified: requiresSponsorship=true on no-sponsorship JD", sponsorResult.disqualified === true);

// -- Knockout: security clearance ---------------------------------------------

console.log("\nKnockout - security clearance:");

const clearanceJd =
  "Candidates must hold an active security clearance at the TS/SCI level.";

const noClearanceAnswers: ApplicationAnswersData = { ...goodAnswers, hasClearance: false };
const clearanceResult = evaluateKnockouts({ jobText: clearanceJd, answers: noClearanceAnswers });
check("disqualified: hasClearance=false vs clearance-required JD", clearanceResult.disqualified === true);

const hasClearanceResult = evaluateKnockouts({ jobText: clearanceJd, answers: goodAnswers });
check("NOT disqualified: hasClearance=true vs clearance-required JD", hasClearanceResult.disqualified === false);

// -- Knockout: matching candidate passes all gates -----------------------------

console.log("\nKnockout - fully matching candidate:");

const standardJd = "Looking for a great software engineer.";
const standardResult = evaluateKnockouts({ jobText: standardJd, answers: goodAnswers });
check("NOT disqualified on a standard JD with no hard requirements", standardResult.disqualified === false);

// -- Knockout: UNKNOWN answers never disqualify --------------------------------

console.log("\nKnockout - unknown fields never disqualify:");

const unknownYearsAnswers: ApplicationAnswersData = {
  ...goodAnswers,
  yearsExperience: undefined,
};
const unknownYearsResult = evaluateKnockouts({ jobText: yearsJd, answers: unknownYearsAnswers });
check("NOT disqualified: yearsExperience=undefined vs 10+ JD", unknownYearsResult.disqualified === false);

const unknownAuthAnswers: ApplicationAnswersData = {
  ...goodAnswers,
  workAuthorized: undefined,
  requiresSponsorship: undefined,
};
const unknownAuthResult = evaluateKnockouts({ jobText: authJd, answers: unknownAuthAnswers });
check("NOT disqualified: workAuthorized=undefined vs no-sponsorship JD", unknownAuthResult.disqualified === false);

const unknownClearanceAnswers: ApplicationAnswersData = {
  ...goodAnswers,
  hasClearance: undefined,
};
const unknownClearanceResult = evaluateKnockouts({ jobText: clearanceJd, answers: unknownClearanceAnswers });
check("NOT disqualified: hasClearance=undefined vs clearance-required JD", unknownClearanceResult.disqualified === false);

// -- Field plan: critical flags ------------------------------------------------

console.log("\nField plan - critical field flags:");

const basicJd = "We are hiring a software engineer.";
const plan = planFields({ jobText: basicJd, answers: goodAnswers, contact });

function findField(key: string) {
  return plan.find((f) => f.key === key);
}

check("workAuthorization is critical", findField("workAuthorization")?.critical === true);
check("requiresSponsorship is critical", findField("requiresSponsorship")?.critical === true);
check("salaryExpectation is critical", findField("salaryExpectation")?.critical === true);
check("clearance is critical", findField("clearance")?.critical === true);
check("yearsExperience is NOT critical", findField("yearsExperience")?.critical === false);
check("willingToRelocate is NOT critical", findField("willingToRelocate")?.critical === false);
check("fullName is NOT critical", findField("fullName")?.critical === false);

// -- Field plan: free-text detection ------------------------------------------

console.log("\nField plan - free-text detection:");

const coverLetterJd =
  "Submit a cover letter telling us why you want to work here.";
const ctPlan = planFields({ jobText: coverLetterJd, answers: goodAnswers, contact });
const ctField = ctPlan.find((f) => f.key === "coverLetter");
check("coverLetter field present when JD mentions cover letter", ctField !== undefined);
check("coverLetter has freeText:true", ctField?.freeText === true);
check("coverLetter has critical:false", ctField?.critical === false);
check("coverLetter has value:''", ctField?.value === "");

const noCoverJd = "We are hiring a backend engineer. 5+ years required.";
const noCoverPlan = planFields({ jobText: noCoverJd, answers: goodAnswers, contact });
check("no coverLetter field on a standard JD", noCoverPlan.find((f) => f.key === "coverLetter") === undefined);

const personalStatementJd = "Include a personal statement about your experience.";
const personalPlan = planFields({ jobText: personalStatementJd, answers: goodAnswers, contact });
check(
  "coverLetter field added when JD says 'personal statement'",
  personalPlan.find((f) => f.key === "coverLetter") !== undefined,
);

// -- Field plan: source and confidence ----------------------------------------

console.log("\nField plan - source and confidence:");

const presentLinkedIn = findField("linkedinUrl");
check(
  "present linkedin answer → source 'answers' + high confidence",
  presentLinkedIn?.source === "answers" && (presentLinkedIn?.confidence ?? 0) >= 0.9,
);

const absentAnswers: ApplicationAnswersData = {
  ...goodAnswers,
  linkedinUrl: undefined,
  githubUrl: undefined,
};
const absentPlan = planFields({ jobText: basicJd, answers: absentAnswers, contact });
const absentLinkedIn = absentPlan.find((f) => f.key === "linkedinUrl");
check("absent linkedin → source 'unknown'", absentLinkedIn?.source === "unknown");
check("absent linkedin → value ''", absentLinkedIn?.value === "");
check("absent linkedin → low confidence", (absentLinkedIn?.confidence ?? 1) <= 0.3);

const profileName = findField("fullName");
check(
  "contact name → source 'profile' + high confidence",
  profileName?.source === "profile" && (profileName?.confidence ?? 0) >= 0.9,
);

const noEmailContact = { ...contact, email: undefined };
const noEmailPlan = planFields({ jobText: basicJd, answers: goodAnswers, contact: noEmailContact });
const emailField = noEmailPlan.find((f) => f.key === "email");
check("absent contact email → source 'unknown'", emailField?.source === "unknown");
check("absent contact email → value ''", emailField?.value === "");

// -- Field plan: EEO rows ------------------------------------------------------

console.log("\nField plan - EEO rows:");

const eeoAnswers: ApplicationAnswersData = {
  ...goodAnswers,
  eeo: { race: "Prefer not to say", gender: "Male", veteran: "No", disability: "No" },
};
const eeoPlan = planFields({ jobText: basicJd, answers: eeoAnswers, contact });
check("eeoRace present when eeo defined", eeoPlan.find((f) => f.key === "eeoRace") !== undefined);
check("eeoRace is critical", eeoPlan.find((f) => f.key === "eeoRace")?.critical === true);
check("eeoGender is critical", eeoPlan.find((f) => f.key === "eeoGender")?.critical === true);
check("eeoVeteran is critical", eeoPlan.find((f) => f.key === "eeoVeteran")?.critical === true);
check("eeoDisability is critical", eeoPlan.find((f) => f.key === "eeoDisability")?.critical === true);

const noEeoPlan = planFields({ jobText: basicJd, answers: goodAnswers, contact });
check("no EEO rows when eeo is undefined", noEeoPlan.find((f) => f.key === "eeoRace") === undefined);

// -- Summary -------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
