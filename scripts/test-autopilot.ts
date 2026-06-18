/**
 * Autopilot policy + orchestrator validation gate.
 * Run: npm run test:autopilot
 */
import { mayAutoSubmit, mustStopAtReview } from "@/lib/autopilot/policy";
import {
  discoveryQueryForUser,
  runAutopilotCycle,
} from "@/lib/autopilot/orchestrator";
import { createOAuthState, verifyOAuthState } from "@/lib/gmail/oauth-state";
import { db } from "@/lib/db";
import { createProfile, deleteProfile } from "@/lib/profiles/service";
import { getPrimaryUser } from "@/lib/user";
import { readFileSync } from "node:fs";
import path from "node:path";

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

async function dbPing(): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return false;
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log("\nautopilot - policy:");

  check("AUTONOMOUS may auto-submit", mayAutoSubmit("AUTONOMOUS") === true);
  check("ASSISTED may NOT auto-submit", mayAutoSubmit("ASSISTED") === false);
  check("MANUAL may NOT auto-submit", mayAutoSubmit("MANUAL") === false);
  check("ASSISTED stops at review", mustStopAtReview("ASSISTED") === true);
  check("MANUAL stops at review", mustStopAtReview("MANUAL") === true);
  check("AUTONOMOUS does not stop at review gate by policy", mustStopAtReview("AUTONOMOUS") === false);

  const prev = process.env.JOBS_DEFAULT_QUERY;
  process.env.JOBS_DEFAULT_QUERY = "platform engineer";
  const q = await discoveryQueryForUser({
    userId: "nonexistent-user-id",
    profileId: "default-profile",
  });
  check("discovery query falls back to env default", q === "platform engineer");
  if (prev === undefined) delete process.env.JOBS_DEFAULT_QUERY;
  else process.env.JOBS_DEFAULT_QUERY = prev;

  console.log("\nautopilot - orchestrator chain:");
  const orchestratorSrc = readFileSync(
    path.join(process.cwd(), "lib/autopilot/orchestrator.ts"),
    "utf8",
  );
  const loopBody = orchestratorSrc.match(
    /for \(const job of top\)[\s\S]*?catch \(e\)/,
  )?.[0] ?? "";
  const briefIdx = loopBody.indexOf("ensureBrief");
  const prepareIdx = loopBody.indexOf("prepareApplication");
  check(
    "orchestrator calls ensureBrief before prepare",
    briefIdx >= 0 && prepareIdx > briefIdx,
  );

  console.log("\nautopilot - gmail oauth state (SEC-08):");
  const state = createOAuthState("profile-abc");
  const verified = verifyOAuthState(state);
  check("oauth state verifies for profile", verified?.profileId === "profile-abc");
  check("tampered oauth state rejected", verifyOAuthState(state.slice(0, -1)) === null);

  const dbAvailable = await dbPing();
  if (!dbAvailable) {
    console.log("\nautopilot - DB integration: skipped (no DATABASE_URL)");
  } else {
    console.log("\nautopilot - DB integration (fixtures):");

    const prevFixtures = process.env.JOBS_USE_FIXTURES;
    process.env.JOBS_USE_FIXTURES = "1";

    const user = await getPrimaryUser();
    const profile = await createProfile(user.id, `AutopilotTest-${Date.now()}`);
    const scope = { userId: user.id, profileId: profile.id };

    try {
      const result = await runAutopilotCycle(scope);
      check("runAutopilotCycle retains fixture jobs", result.discovered.kept > 0);
      check("runAutopilotCycle briefs top jobs", result.briefed > 0);
      check(
        "runAutopilotCycle details mention brief ensured",
        result.details.some((d) => d.startsWith("brief ensured:")),
      );
    } finally {
      await deleteProfile(user.id, profile.id);
      if (prevFixtures === undefined) delete process.env.JOBS_USE_FIXTURES;
      else process.env.JOBS_USE_FIXTURES = prevFixtures;
    }
  }

  console.log(`\nautopilot ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
