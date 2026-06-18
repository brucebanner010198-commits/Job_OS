/**
 * Self-test for the interview transcript SCORER brain (Phase 8, plan §5).
 * THIS IS THE test:interview-score gate. Pure, offline, deterministic: it scores
 * the fixed strong/weak fixture transcripts and asserts the scorer ranks a
 * STAR-structured, metric-rich answer far above a vague rambling one.
 * Run: npx tsx scripts/test-interview-score.ts
 */
import { scoreSession } from "@/lib/interview/score";
import {
  fixturePrep,
  fixtureStrongTranscript,
  fixtureWeakTranscript,
} from "@/lib/interview/fixtures";
import type { InterviewMode, SessionScore } from "@/lib/interview/types";

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

/** Every sub-score sits inside the 0..100 band. */
function inRange(s: SessionScore): boolean {
  return [s.clarity, s.structure, s.specificity, s.fit, s.overall].every(
    (v) => v >= 0 && v <= 100,
  );
}

const MODE: InterviewMode = "AI_SCREEN";
const strong = scoreSession(fixtureStrongTranscript, MODE, fixturePrep);
const weak = scoreSession(fixtureWeakTranscript, MODE, fixturePrep);

console.log("\ninterview-score - sub-scores (strong vs weak):");
console.log(
  `  strong  structure=${strong.structure} specificity=${strong.specificity} clarity=${strong.clarity} fit=${strong.fit} overall=${strong.overall}`,
);
console.log(
  `  weak    structure=${weak.structure} specificity=${weak.specificity} clarity=${weak.clarity} fit=${weak.fit} overall=${weak.overall}`,
);

// --- 1. Strong ranks far above weak on the load-bearing sub-scores -----------

console.log("\ninterview-score - strong outranks weak:");
check(
  `structure: strong (${strong.structure}) > weak (${weak.structure}) + 20`,
  strong.structure > weak.structure + 20,
);
check(
  `specificity: strong (${strong.specificity}) > weak (${weak.specificity}) + 20`,
  strong.specificity > weak.specificity + 20,
);
check(
  `overall: strong (${strong.overall}) > weak (${weak.overall})`,
  strong.overall > weak.overall,
);

// --- 2. Every sub-score is within 0..100 -------------------------------------

console.log("\ninterview-score - sub-scores within 0..100:");
check("strong sub-scores in [0,100]", inRange(strong));
check("weak sub-scores in [0,100]", inRange(weak));

// --- 3. Weak answer is coached and flagged -----------------------------------

console.log("\ninterview-score - weak answer is coached + flagged:");
check("weak emits at least one STAR rewrite", weak.starFixes.length > 0);
check('weak flags include "filler"', weak.flags.includes("filler"));
check('weak flags include "no metrics"', weak.flags.includes("no metrics"));

// --- 4. Strong answer earns a positive chip ----------------------------------

console.log("\ninterview-score - strong answer earns a positive chip:");
check(
  'strong flags include "specific" OR "strong STAR"',
  strong.flags.includes("specific") || strong.flags.includes("strong STAR"),
);
check("strong has no \"filler\" chip", !strong.flags.includes("filler"));

// --- 5. Determinism: same input → deep-equal output --------------------------

console.log("\ninterview-score - deterministic (deep-equal on re-run):");
const strongAgain = scoreSession(fixtureStrongTranscript, MODE, fixturePrep);
const weakAgain = scoreSession(fixtureWeakTranscript, MODE, fixturePrep);
check(
  "strong scored twice is deep-equal",
  JSON.stringify(strong) === JSON.stringify(strongAgain),
);
check(
  "weak scored twice is deep-equal",
  JSON.stringify(weak) === JSON.stringify(weakAgain),
);

// --- 6. Empty transcript degrades to a well-formed zero score ----------------

console.log("\ninterview-score - empty transcript is well-formed:");
const empty = scoreSession([], MODE, fixturePrep);
check(
  "no candidate turns → all-zero, no throw",
  empty.overall === 0 && empty.structure === 0 && inRange(empty),
);

// --- Summary -----------------------------------------------------------------

console.log(`\ninterview-score ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
