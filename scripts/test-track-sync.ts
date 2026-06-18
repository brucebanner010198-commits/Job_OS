/**
 * Test gate for lib/track/board.ts + lib/track/sync.ts (Phase 6, plan §8d).
 * Deterministic: drives the pure builders with the shared fixtures and a
 * constant NOW. Run: npx tsx scripts/test-track-sync.ts
 */
import { buildBoard, canMove, COLUMN_TITLES } from "@/lib/track/board";
import { planSync, nextSyncState, dedupeNewEmails } from "@/lib/track/sync";
import { fixtureApps, fixtureRawEmails } from "@/lib/track/fixtures";
import type { AppStatus } from "@/lib/track/types";

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL: ${name}`);
  }
}

// --- buildBoard ------------------------------------------------------------
const board = buildBoard(fixtureApps);
check("board has 6 columns", board.length === 6);

const countOf = (status: AppStatus): number =>
  board.find((c) => c.status === status)?.apps.length ?? -1;

check("WARM_PATH count 1", countOf("WARM_PATH") === 1);
check("TO_APPLY count 1", countOf("TO_APPLY") === 1);
check("APPLIED count 4", countOf("APPLIED") === 4);
check("INTERVIEWING count 2", countOf("INTERVIEWING") === 2);
check("OFFER count 0", countOf("OFFER") === 0);
check("REJECTED count 0", countOf("REJECTED") === 0);

check("no SKIPPED column", board.every((c) => c.status !== "SKIPPED"));
check(
  "titles from COLUMN_TITLES",
  board.every((c) => c.title === COLUMN_TITLES[c.status]),
);
check(
  "APPLIED column preserves input order",
  JSON.stringify(
    board.find((c) => c.status === "APPLIED")?.apps.map((a) => a.id),
  ) === JSON.stringify(["app-stripe", "app-datadog", "app-figma", "app-coinbase"]),
);

// --- canMove ---------------------------------------------------------------
check("canMove APPLIED→INTERVIEWING", canMove("APPLIED", "INTERVIEWING") === true);
check("canMove same status false", canMove("APPLIED", "APPLIED") === false);
check("canMove into SKIPPED false", canMove("APPLIED", "SKIPPED") === false);

// --- planSync --------------------------------------------------------------
const fullPlan = planSync({});
check("planSync({}) mode full", fullPlan.mode === "full");
check("full plan default lookbackDays 30", fullPlan.lookbackDays === 30);
check("full plan has a query", fullPlan.query.length > 0);

const incPlan = planSync({ historyId: "100" });
check("planSync({historyId:100}) mode incremental", incPlan.mode === "incremental");
check("incremental sinceHistoryId 100", incPlan.sinceHistoryId === "100");

const customPlan = planSync({}, { lookbackDays: 7, query: "subject:offer" });
check("planSync opts override lookbackDays", customPlan.lookbackDays === 7);
check("planSync opts override query", customPlan.query === "subject:offer");

// --- nextSyncState ---------------------------------------------------------
const NOW = "2026-06-16T00:00:00.000Z";
const advanced = nextSyncState({ historyId: "100" }, "90", NOW);
check("nextSyncState keeps larger historyId 100", advanced.historyId === "100");
check("nextSyncState stamps lastSyncedAt", advanced.lastSyncedAt === NOW);
check(
  "nextSyncState adopts larger new id",
  nextSyncState({ historyId: "100" }, "150", NOW).historyId === "150",
);
check(
  "nextSyncState adopts new id when no prev",
  nextSyncState({}, "42", NOW).historyId === "42",
);
check(
  "nextSyncState keeps prev when new undefined",
  nextSyncState({ historyId: "77" }, undefined, NOW).historyId === "77",
);

// --- dedupeNewEmails -------------------------------------------------------
const deduped = dedupeNewEmails(["neg-github-1"], fixtureRawEmails);
check(
  "dedupe drops the seen id",
  !deduped.some((e) => e.gmailMessageId === "neg-github-1"),
);
check("dedupe length is N-1", deduped.length === fixtureRawEmails.length - 1);
check(
  "dedupe with empty seen returns all",
  dedupeNewEmails([], fixtureRawEmails).length === fixtureRawEmails.length,
);

// --- report ----------------------------------------------------------------
const total = pass + fail;
console.log(`sync ${pass}/${total}`);
if (fail > 0) process.exit(1);
