/**
 * Onboarding unit tests — coaching stop logic, provenance merge, setupPartial.
 * Run: npm run test:onboarding
 */
import {
  userDoneSignal,
  evaluateCoachingStop,
} from "@/lib/onboarding/coaching";
import { mergeEntriesByProvenance } from "@/lib/onboarding/profile-compiler";
import type { CompiledEntry } from "@/lib/onboarding/types";
import {
  isSetupPartialNote,
  detectSetupPartial,
} from "@/lib/pipeline/setup-status";

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

console.log("\ncoaching — user done signal:");
check("detects that's everything", userDoneSignal("that's everything"));
check("detects nothing else", userDoneSignal("nothing else to add"));
check("detects I'm done", userDoneSignal("I'm done for now"));
check("ignores normal answer", !userDoneSignal("I worked at Acme from 2020 to 2022"));

console.log("\ncoaching — stop evaluation:");
check(
  "shouldStop proceeds to compile",
  evaluateCoachingStop({
    shouldStop: true,
    finalGapCheck: false,
    coverageSufficient: false,
    userSignaledDone: false,
    remainingGaps: [],
  }).proceedToCompile,
);
check(
  "user done + gaps shows final gap check",
  evaluateCoachingStop({
    shouldStop: false,
    finalGapCheck: false,
    coverageSufficient: false,
    userSignaledDone: true,
    remainingGaps: ["Target role"],
  }).showFinalGapCheck,
);
check(
  "sufficient + user done + no gaps proceeds",
  evaluateCoachingStop({
    shouldStop: false,
    finalGapCheck: false,
    coverageSufficient: true,
    userSignaledDone: true,
    remainingGaps: [],
  }).proceedToCompile,
);
check(
  "user done with gaps does not proceed without shouldStop",
  !evaluateCoachingStop({
    shouldStop: false,
    finalGapCheck: false,
    coverageSufficient: false,
    userSignaledDone: true,
    remainingGaps: ["Education dates"],
  }).proceedToCompile,
);

console.log("\nprofile compiler — provenance merge:");
const resumeEntry: CompiledEntry = {
  kind: "EXPERIENCE",
  title: "Software Engineer at Acme",
  data: { company: "Acme", title: "Software Engineer" },
  sensitive: false,
  provenance: "resume",
};
const conversationEntry: CompiledEntry = {
  kind: "EXPERIENCE",
  title: "Software Engineer at Acme",
  data: { company: "Acme Corp", title: "Senior Software Engineer" },
  sensitive: false,
  provenance: "conversation",
};
const merged = mergeEntriesByProvenance([resumeEntry, conversationEntry]);
check("merge keeps one entry", merged.length === 1);
check(
  "conversation overrides resume on conflict",
  merged[0]?.provenance === "conversation" &&
    merged[0]?.data.title === "Senior Software Engineer",
);
check(
  "paste beats resume",
  mergeEntriesByProvenance([
    resumeEntry,
    { ...resumeEntry, provenance: "paste", data: { company: "Acme Inc" } },
  ])[0]?.provenance === "paste",
);
check(
  "distinct titles both kept",
  mergeEntriesByProvenance([
    resumeEntry,
    { ...resumeEntry, title: "Designer at Beta", provenance: "conversation" },
  ]).length === 2,
);

console.log("\nsetup status — setupPartial:");
check(
  "setup-partial source flagged",
  isSetupPartialNote("setup-partial", "any text"),
);
check(
  "legacy onboarding-coaching note flagged",
  isSetupPartialNote(
    "onboarding-coaching",
    "Onboarding completed with coaching skipped — goals and gaps may be incomplete.",
  ),
);
check(
  "normal coaching note not partial",
  !isSetupPartialNote("onboarding-coaching", "USER: I led the platform team"),
);
check(
  "detectSetupPartial finds note in list",
  detectSetupPartial([
    { source: "import", rawText: "resume text" },
    { source: "setup-partial", rawText: "skipped" },
  ]),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
