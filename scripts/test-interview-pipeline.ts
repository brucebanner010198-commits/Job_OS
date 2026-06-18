/**
 * Self-test for the interview-prep PIPELINE (Phase 8, plan §5). Pure, offline,
 * deterministic - no DB, no network, no wall clock. It exercises previewInterview
 * (the offline board the page falls back to) and asserts the always-free study
 * core is well-formed and SAFE: every prep has a 5-question guide and the
 * sensitive fixture fact ("chronic health condition") never appears anywhere.
 * Run: npx tsx scripts/test-interview-pipeline.ts
 */
import { previewInterview, processInterviewPreps } from "@/lib/interview/pipeline";
import { fixturePreps } from "@/lib/interview/fixtures";
import { STUDY_QUESTION_TARGET } from "@/lib/interview/types";
import type { InterviewPrepView } from "@/lib/interview/types";

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

/** The sensitive fixture text that must NEVER appear in any guide output. */
const SENSITIVE = "chronic health condition";

/** Concatenate every string a prep view could surface, for a leak scan. */
function prepText(p: InterviewPrepView): string {
  const parts: string[] = [p.company, p.role ?? "", p.status];
  for (const q of p.guide.questions) {
    parts.push(q.question, q.modelAnswer, q.tip, q.category);
    if (q.starParts) {
      parts.push(
        q.starParts.situation,
        q.starParts.task,
        q.starParts.action,
        q.starParts.result,
      );
    }
  }
  return parts.join(" \n ");
}

// --- 1. previewInterview returns a coherent offline board --------------------

console.log("\ninterview-pipeline - offline preview is a well-formed board:");
const board = previewInterview();
check("preview returns >=1 prep", board.preps.length >= 1);
check(
  "preview prep count matches the fixture corpus",
  board.preps.length === fixturePreps.length,
);
check("voice status is present", Boolean(board.voice && board.voice.provider));
check(
  "dailyRemainingSec equals the full daily cap (no usage offline)",
  board.dailyRemainingSec === board.caps.dailyCapSec,
);

// --- 2. Every prep has exactly a 5-question guide + no live sessions ---------

console.log("\ninterview-pipeline - every prep has a 5-question study guide:");
for (const p of board.preps) {
  check(
    `${p.company}: guide has exactly ${STUDY_QUESTION_TARGET} questions`,
    p.guide.questions.length === STUDY_QUESTION_TARGET,
  );
  check(
    `${p.company}: every question is non-empty with a model answer`,
    p.guide.questions.every(
      (q) => q.question.trim().length > 0 && q.modelAnswer.trim().length > 0,
    ),
  );
  check(`${p.company}: starts with no sessions`, p.sessions.length === 0);
}

// --- 3. Provenance + invite flags track the fixtures' ground truth -----------

console.log("\ninterview-pipeline - provenance + invite flags match fixtures:");
for (const f of fixturePreps) {
  const view = board.preps.find((p) => p.company === f.prep.company);
  check(`${f.prep.company}: present in the board`, Boolean(view));
  if (!view) continue;
  check(
    `${f.prep.company}: provenanceOk === expectGrounded (${f.expectGrounded})`,
    view.guide.provenanceOk === f.expectGrounded,
  );
  check(
    `${f.prep.company}: fromInvite === fixture fromInvite (${f.fromInvite})`,
    view.fromInvite === f.fromInvite,
  );
}

// --- 4. SENSITIVE FACTS NEVER LEAVE ------------------------------------------

console.log("\ninterview-pipeline - sensitive facts never leak into a guide:");
for (const p of board.preps) {
  check(
    `${p.company}: no sensitive text anywhere in the prep view`,
    !prepText(p).toLowerCase().includes(SENSITIVE),
  );
}
const grounded = board.preps.find((p) => p.guide.provenanceOk);
check(
  "a grounded guide withheld the one sensitive fixture fact",
  Boolean(grounded && grounded.guide.withheldSensitive >= 1),
);

// --- 5. processInterviewPreps honors per-prep metadata + defaults ------------

console.log("\ninterview-pipeline - processInterviewPreps mapping:");
const mapped = processInterviewPreps([fixturePreps[0].prep], {
  meta: [{ status: "OFFER", fromInvite: true, interviewAt: "2026-06-20T15:00:00.000Z" }],
});
check("status maps from opts", mapped[0].status === "OFFER");
check("fromInvite maps from opts", mapped[0].fromInvite === true);
check(
  "interviewAt maps from opts",
  mapped[0].interviewAt === "2026-06-20T15:00:00.000Z",
);
const defaulted = processInterviewPreps([fixturePreps[1].prep]);
check(
  "status defaults to INTERVIEWING when unmapped",
  defaulted[0].status === "INTERVIEWING",
);
check("fromInvite defaults to false when unmapped", defaulted[0].fromInvite === false);

// --- Summary -----------------------------------------------------------------

console.log(`\ninterview-pipeline ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
