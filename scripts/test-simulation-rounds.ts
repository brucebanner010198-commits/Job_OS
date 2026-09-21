import { getCompanyInterviewIntel } from "../lib/interview/company-research";
import { buildOnboardingGuide } from "../lib/career/onboarding-guide";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("PASS:", msg);
}

async function testSimulationAndCareer() {
  console.log("Testing Interview Simulation Intelligence & Career Onboarding...\n");

  // 1. Company interview intelligence
  const intel = await getCompanyInterviewIntel("Google", "Site Reliability Engineer");
  assert(Boolean(intel.aiScreeningFormat), "Generates AI screening format");
  assert(Boolean(intel.hrInterviewStyle), "Generates HR interview style");
  assert(intel.commonQuestionThemes.length >= 2, "Includes common question themes");
  assert(Boolean(intel.preparationAdvice), "Includes actionable prep advice");

  // 2. Onboarding guide
  const guide = buildOnboardingGuide("Stripe", "Staff Engineer");
  assert(guide.company === "Stripe", "Guides for Stripe");
  assert(guide.firstDayHrChecklist.length >= 3, "Has HR checklist (I-9, banking, benefits)");
  assert(guide.firstThirtyDaysRoadmap.length === 3, "Has 30-60-90 day roadmap");

  console.log("\nInterview simulation & onboarding tests passed successfully!");
}

testSimulationAndCareer().catch((e) => {
  console.error(e);
  process.exit(1);
});
