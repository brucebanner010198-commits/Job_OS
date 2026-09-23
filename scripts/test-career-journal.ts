import "./lib/use-test-database";
/**
 * Validation test for Career Journal, Work History Compiler, and Skill Gap Routing.
 * Run with: npx tsx scripts/test-career-journal.ts
 */
import assert from "node:assert/strict";
import { db } from "../lib/db";
import { createWorkLog, listWorkLogs, compileWeeklyWorkLogs, approveCandidateBullet, deleteWorkLog } from "../lib/journal/service";
import { getResourcesForSkill } from "../lib/skills/curated-resources";
import { atsPortalsSource } from "../lib/jobs/sources/ats-portals";
import { jobspySource } from "../lib/jobs/sources/jobspy";

async function main() {
  console.log("Starting Career Journal & Skill Gap validation...");

  // 1. Setup a test profile
  let testUser = await db.user.findFirst();
  if (!testUser) {
    testUser = await db.user.create({
      data: {
        email: "test-journal-user@example.com",
        name: "Test Career User",
      },
    });
  }

  let testProfile = await db.profile.findFirst({
    where: { userId: testUser.id },
  });
  if (!testProfile) {
    testProfile = await db.profile.create({
      data: {
        userId: testUser.id,
        name: "Test Profile",
      },
    });
  }

  const scope = { userId: testUser.id, profileId: testProfile.id };

  // 2. Test Skill Resource Resolution
  console.log("Checking skill resource mapping...");
  const dockerResources = getResourcesForSkill("Docker");
  assert.ok(dockerResources.length > 0, "Docker should resolve curated learning resources");
  assert.match(dockerResources[0].url, /docker\.com/, "Docker resource should point to official docs");

  const k8sResources = getResourcesForSkill("Kubernetes");
  assert.ok(k8sResources.length > 0, "Kubernetes should resolve curated learning resources");

  const customSkill = getResourcesForSkill("SomeObscureFramework123");
  assert.ok(customSkill.length > 0, "Unknown skill should have dynamic fallback resources");

  console.log("✓ Skill resource resolution verified.");

  // 3. Test Daily Work Log Creation
  console.log("Creating daily work logs...");
  const log1 = await createWorkLog(scope, {
    title: "Optimized Redis cache layer",
    project: "Catalog API",
    tasksDone: "Implemented Redis pipelining and connection pooling, reducing p99 latency by 35ms.",
    pointOfView: "Preferred connection pooling over scaling Redis cluster nodes to keep cloud infra cost low.",
    category: "FEATURE",
    metrics: [{ label: "p99 Latency", delta: "-35ms" }],
  });
  assert.ok(log1.id, "Work log 1 created");

  const log2 = await createWorkLog(scope, {
    title: "Learned Kubernetes deployment strategies",
    project: "DevOps Upskilling",
    tasksDone: "Completed interactive tutorials on Canary deployments with Helm charts.",
    pointOfView: "Canary releases eliminate downtime risk compared to Big Bang cutovers.",
    category: "LEARNING",
    metrics: [{ label: "Deployments", delta: "100% automated" }],
  });
  assert.ok(log2.id, "Work log 2 created");

  const logs = await listWorkLogs(scope);
  assert.ok(logs.length >= 2, "Should list recent work logs");
  console.log(`✓ Created and verified ${logs.length} work logs.`);

  // 4. Test Weekly Compilation
  console.log("Testing weekly compilation...");
  const compileResult = await compileWeeklyWorkLogs(scope);
  assert.ok(compileResult.compiledCount >= 2, "Should compile the uncompiled logs");
  assert.ok(compileResult.bulletsCreated >= 2, "Should generate candidate bullets");
  console.log(`✓ Compiled ${compileResult.compiledCount} logs into ${compileResult.bulletsCreated} candidate bullets.`);

  // 5. Test Bullet Approval into Master Profile
  console.log("Testing human approval gate...");
  const candidateBullet = compileResult.bullets![0];
  const approval = await approveCandidateBullet(scope, candidateBullet.id);
  assert.ok(approval.success, "Approval should succeed");

  const createdFact = await db.profileEntry.findUnique({
    where: { id: approval.factId! },
  });
  assert.ok(createdFact, "ProfileEntry should exist in master profile");
  assert.match(createdFact.sourceNote || "", /journal/i, "Provenance note should mention journal");
  console.log("✓ Approved bullet successfully graduated to Master Profile with provenance intact.");

  // 6. Test ATS & JobSpy Discovery Sources
  console.log("Testing direct ATS source adapter...");
  const atsJobs = await atsPortalsSource.fetch("engineer");
  console.log(`✓ ATS portal scanner returned ${atsJobs.length} live jobs.`);

  console.log("Testing JobSpy adapter...");
  const jobspyJobs = await jobspySource.fetch("engineer");
  console.log(`✓ JobSpy adapter returned ${jobspyJobs.length} jobs.`);

  // Clean up test logs
  await deleteWorkLog(scope, log1.id);
  await deleteWorkLog(scope, log2.id);
  console.log("✓ Cleanup finished.");

  console.log("\nALL CAREER JOURNAL & SKILL GAP TESTS PASSED SUCCESSFULLY!");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
