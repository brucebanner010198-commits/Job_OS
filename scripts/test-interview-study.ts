/**
 * Self-test for the study-guide BRAIN (Phase 8, plan §5).
 * THIS IS THE test:interview-study gate. Pure, offline, deterministic: it runs
 * the brain over the fixture preps and asserts the extractive + sensitivity
 * guarantees hold.
 * Run: npx tsx scripts/test-interview-study.ts
 */
import { buildStudyGuide } from "@/lib/interview/study";
import { fixturePreps } from "@/lib/interview/fixtures";
import type { QAItem } from "@/lib/interview/types";

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

/** The sensitive fact text that must NEVER surface anywhere in a guide. */
const SENSITIVE_TEXT = "chronic health condition";

/** All quantified metrics ("40%", "$20M", "5M", …) inside a fact's text. */
function metricsOf(text: string): string[] {
  const re = /\$\d[\d.,]*[MKB]?|\d[\d.,]*%|\d[\d.,]*[MKB]\b/gi;
  return text.match(re) ?? [];
}

/** Every string carried by one question (for full sensitive-text sweeps). */
function stringsOf(q: QAItem): string[] {
  return [
    q.question,
    q.modelAnswer,
    q.tip,
    q.starParts?.situation ?? "",
    q.starParts?.task ?? "",
    q.starParts?.action ?? "",
    q.starParts?.result ?? "",
  ];
}

// --- Per-prep guarantees ------------------------------------------------------

for (const fp of fixturePreps) {
  const { prep, expectGrounded } = fp;
  const label = prep.company;
  const guide = buildStudyGuide(prep);

  console.log(`\nstudy - ${label}:`);

  // 1. Exactly five questions.
  check(`${label}: exactly 5 questions`, guide.questions.length === 5);

  // 2. Categories span ≥4 distinct values.
  const categories = new Set(guide.questions.map((q) => q.category));
  check(`${label}: ≥4 distinct categories (${categories.size})`, categories.size >= 4);

  // 3. provenanceOk matches the fixture's ground truth.
  check(
    `${label}: provenanceOk === expectGrounded (${expectGrounded})`,
    guide.provenanceOk === expectGrounded,
  );

  // 4. Every usedFactId is a real, non-sensitive fact id present in the prep.
  const validIds = new Set(
    prep.facts.filter((f) => !f.sensitive).map((f) => f.id),
  );
  const allIdsValid = guide.questions.every((q) =>
    q.usedFactIds.every((id) => validIds.has(id)),
  );
  check(`${label}: every usedFactId is a real non-sensitive fact`, allIdsValid);

  // 5. The sensitive fact text appears in NO question / answer / tip / STAR part.
  const sensitiveLeak = guide.questions
    .flatMap(stringsOf)
    .some((s) => s.includes(SENSITIVE_TEXT));
  check(`${label}: no sensitive text anywhere in the guide`, !sensitiveLeak);

  // 6. withheldSensitive equals the count of sensitive facts in the input.
  const sensitiveCount = prep.facts.filter((f) => f.sensitive).length;
  check(
    `${label}: withheldSensitive === ${sensitiveCount}`,
    guide.withheldSensitive === sensitiveCount,
  );

  // 7. Grounding consistency: grounded ⇒ every answer cites ≥1 fact; ungrounded
  //    ⇒ every answer cites none.
  if (expectGrounded) {
    check(
      `${label}: every grounded answer cites ≥1 fact`,
      guide.questions.every((q) => q.usedFactIds.length > 0),
    );

    // 8. At least one model answer carries a REAL metric substring from a fact.
    const factMetrics = new Set(
      prep.facts
        .filter((f) => !f.sensitive)
        .flatMap((f) => metricsOf(f.text)),
    );
    const answers = guide.questions.map((q) => q.modelAnswer);
    const hasMetric = [...factMetrics].some((m) =>
      answers.some((a) => a.includes(m)),
    );
    check(
      `${label}: a model answer contains a real metric from a fact`,
      hasMetric,
    );
  } else {
    check(
      `${label}: ungrounded answers cite no facts`,
      guide.questions.every((q) => q.usedFactIds.length === 0),
    );
  }
}

// --- Summary -----------------------------------------------------------------

console.log(`\nstudy ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
