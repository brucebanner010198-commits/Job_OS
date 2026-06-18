/**
 * Phase 7 warm-path RANKING gate.
 *
 * Proves deterministically (no LLM, no DB, no network, no clock):
 *   1. Notion → best path is Priya Sharma, CURRENT_COLLEAGUE, strength ≥ 0.9,
 *      reachOut true; Priya ranks BEFORE Marcus (strongest-first).
 *   2. Linear → best path Alex Chen, ALUMNI, reachOut true (≥ 0.4 threshold).
 *   3. Datadog → best path NONE, strength 0, reachOut false, gate says apply
 *      directly (no fabricated tie).
 *   4. Every WarmPath has a non-empty reasons array; the NONE path's connection
 *      is undefined.
 *
 * Run: npx tsx scripts/test-warm-rank.ts
 */
import { rankWarmPaths, bestWarmPath } from "@/lib/warm/rank";
import { fixtureConnections, fixtureTargets } from "@/lib/warm/fixtures";
import { MIN_STRENGTH_TO_REACH_OUT } from "@/lib/warm/types";

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

const notion = fixtureTargets.find((t) => t.company === "Notion")!;
const linear = fixtureTargets.find((t) => t.company === "Linear")!;
const datadog = fixtureTargets.find((t) => t.company === "Datadog")!;

// -- 1. Notion - Priya is the strongest current-colleague path ----------------
console.log("\n1. Notion - current colleague outranks community contact:");

const notionPaths = rankWarmPaths(notion, fixtureConnections);
const notionBest = bestWarmPath(notion, fixtureConnections);

check("Notion best path is Priya Sharma", notionBest.connection?.fullName === "Priya Sharma");
check("Notion best pathKind is CURRENT_COLLEAGUE", notionBest.pathKind === "CURRENT_COLLEAGUE");
check("Notion best strength ≥ 0.9", notionBest.strength >= 0.9);
check("Notion best reachOut is true", notionBest.reachOut === true);
check("Notion best gateReason is populated", notionBest.gateReason.length > 0);

const priyaIdx = notionPaths.findIndex((p) => p.connection?.fullName === "Priya Sharma");
const marcusIdx = notionPaths.findIndex((p) => p.connection?.fullName === "Marcus Webb");
check("Notion returns both Priya and Marcus", priyaIdx !== -1 && marcusIdx !== -1);
check("Priya ranks BEFORE Marcus (strongest-first)", priyaIdx < marcusIdx);

// -- 2. Linear - Alex Chen is an ALUMNI path above the gate -------------------
console.log("\n2. Linear - alumni path clears the reach-out gate:");

const linearBest = bestWarmPath(linear, fixtureConnections);
check("Linear best path is Alex Chen", linearBest.connection?.fullName === "Alex Chen");
check("Linear best pathKind is ALUMNI", linearBest.pathKind === "ALUMNI");
check("Linear best reachOut is true", linearBest.reachOut === true);
check(
  "Linear best strength ≥ MIN_STRENGTH_TO_REACH_OUT",
  linearBest.strength >= MIN_STRENGTH_TO_REACH_OUT,
);

// -- 3. Datadog - no genuine tie → NONE → apply cold --------------------------
console.log("\n3. Datadog - no path, gate recommends applying directly:");

const datadogPaths = rankWarmPaths(datadog, fixtureConnections);
const datadogBest = bestWarmPath(datadog, fixtureConnections);
check("Datadog returns exactly one path", datadogPaths.length === 1);
check("Datadog best pathKind is NONE", datadogBest.pathKind === "NONE");
check("Datadog best strength is 0", datadogBest.strength === 0);
check("Datadog best reachOut is false", datadogBest.reachOut === false);
check(
  "Datadog gateReason mentions applying directly",
  datadogBest.gateReason.toLowerCase().includes("directly"),
);
check("Datadog NONE path connection is undefined", datadogBest.connection === undefined);

// -- 4. Invariants across every path ------------------------------------------
console.log("\n4. Invariants - reasons always populated, strengths sorted:");

const allPaths = [...notionPaths, ...rankWarmPaths(linear, fixtureConnections), ...datadogPaths];
check(
  "every WarmPath has a non-empty reasons array",
  allPaths.every((p) => Array.isArray(p.reasons) && p.reasons.length > 0),
);
check(
  "every reachOut path is at or above the strength gate",
  allPaths.every((p) => !p.reachOut || p.strength >= MIN_STRENGTH_TO_REACH_OUT),
);
check(
  "Notion paths are sorted strongest-first",
  notionPaths.every((p, i) => i === 0 || notionPaths[i - 1].strength >= p.strength),
);
check(
  "every strength is rounded to ≤ 2 decimals in [0,1]",
  allPaths.every(
    (p) =>
      p.strength >= 0 &&
      p.strength <= 1 &&
      Math.round(p.strength * 100) / 100 === p.strength,
  ),
);

// -- Summary ------------------------------------------------------------------
const total = passed + failed;
if (failed > 0) {
  console.error(`\nwarm-rank FAILED: ${passed}/${total} (${failed} failing)\n`);
  process.exit(1);
}
console.log(`\nwarm-rank ${passed}/${total}\n`);
