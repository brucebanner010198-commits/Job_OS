/**
 * Sources validation gate (plan §8 Phase 3): offline, no DB, no network.
 * Asserts fixture composition, source interface contract, and discover()
 * offline behaviour. Run: npx tsx scripts/test-jobs-sources.ts
 */

import { fixtureJobs, fixturesSource } from "@/lib/jobs/sources/fixtures";
import { jsearchSource } from "@/lib/jobs/sources/jsearch";
import { remotiveSource } from "@/lib/jobs/sources/remotive";
import { remoteokSource } from "@/lib/jobs/sources/remoteok";
import { arbeitnowSource } from "@/lib/jobs/sources/arbeitnow";
import { jobicySource } from "@/lib/jobs/sources/jobicy";
import { SOURCES, enabledSources, discover } from "@/lib/jobs/sources/index";

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

async function main(): Promise<void> {
  // --- Fixture dataset assertions ---------------------------------------------

  console.log("\nfixture dataset:");

  check("fixtureJobs has ≥16 entries", fixtureJobs.length >= 16);

  // Near-dup cluster: ≥3 entries sharing the same company+title
  const clusterCounts = new Map<string, number>();
  for (const job of fixtureJobs) {
    const key = `${job.company.toLowerCase()}|${job.title.toLowerCase()}`;
    clusterCounts.set(key, (clusterCounts.get(key) ?? 0) + 1);
  }
  const maxClusterSize = Math.max(...clusterCounts.values());
  check("near-dup cluster exists (≥3 same company+title)", maxClusterSize >= 3);

  // Exact duplicate: identical company+title+location appearing ≥2 times
  const exactCounts = new Map<string, number>();
  for (const job of fixtureJobs) {
    const key = [
      job.company.toLowerCase(),
      job.title.toLowerCase(),
      (job.location ?? "").toLowerCase(),
    ].join("|");
    exactCounts.set(key, (exactCounts.get(key) ?? 0) + 1);
  }
  check(
    "exact duplicate present (same company+title+location ×2)",
    [...exactCounts.values()].some((n) => n >= 2),
  );

  // Ghost pattern: evergreen language, no concrete responsibilities
  const ghostPatterns = [
    "always looking for talented",
    "talent community",
    "join our talent community",
  ];
  check(
    "ghost-pattern entry present",
    fixtureJobs.some((j) =>
      ghostPatterns.some((p) => j.description.toLowerCase().includes(p)),
    ),
  );

  // Scam pattern: unrealistic pay, contact via messaging app, fee, gmail recruiter
  const scamPatterns = [
    "$5,000",
    "onboarding and processing fee",
    "telegram",
    "whatsapp",
    "gmail.com",
  ];
  check(
    "scam-pattern entry present",
    fixtureJobs.some((j) =>
      scamPatterns.some((p) =>
        j.description.toLowerCase().includes(p.toLowerCase()),
      ),
    ),
  );

  // Hard-requirement phrases required by the downstream hard-gate
  check(
    "entry with '8+ years' hard requirement",
    fixtureJobs.some((j) => j.description.includes("8+ years")),
  );
  check(
    "entry with 'PhD' hard requirement",
    fixtureJobs.some((j) => j.description.toLowerCase().includes("phd")),
  );
  check(
    "entry with citizen + clearance hard requirement",
    fixtureJobs.some(
      (j) =>
        j.description.toLowerCase().includes("citizen") &&
        j.description.toLowerCase().includes("clearance"),
    ),
  );
  check(
    "entry with 'without sponsorship' hard requirement",
    fixtureJobs.some((j) =>
      j.description.toLowerCase().includes("without sponsorship"),
    ),
  );

  // --- Source interface contract -----------------------------------------------

  console.log("\nsource interfaces:");

  for (const src of [
    fixturesSource,
    jsearchSource,
    remotiveSource,
    remoteokSource,
    arbeitnowSource,
    jobicySource,
  ]) {
    check(
      `${src.name}: has name/enabled/fetch`,
      typeof src.name === "string" &&
        typeof src.enabled === "function" &&
        typeof src.fetch === "function",
    );
  }

  check(
    "SOURCES contains six adapters",
    SOURCES.length === 6 &&
      SOURCES.some((s) => s.name === "fixtures") &&
      SOURCES.some((s) => s.name === "jsearch") &&
      SOURCES.some((s) => s.name === "remotive") &&
      SOURCES.some((s) => s.name === "remoteok") &&
      SOURCES.some((s) => s.name === "arbeitnow") &&
      SOURCES.some((s) => s.name === "jobicy"),
  );

  // --- fixturesSource behaviour ------------------------------------------------

  console.log("\nfixturesSource behaviour:");

  const allJobs = await fixturesSource.fetch("");
  check(
    "fetch('') returns all fixture jobs",
    allJobs.length === fixtureJobs.length,
  );

  const engineerJobs = await fixturesSource.fetch("engineer");
  check(
    "fetch('engineer') returns a non-empty subset",
    engineerJobs.length > 0 && engineerJobs.length <= allJobs.length,
  );
  check(
    "fetch('engineer') results all contain 'engineer' in title or description",
    engineerJobs.every(
      (j) =>
        j.title.toLowerCase().includes("engineer") ||
        j.description.toLowerCase().includes("engineer"),
    ),
  );

  const noMatchJobs = await fixturesSource.fetch("xyz-no-match-999");
  check(
    "fetch with no-match query returns empty array",
    noMatchJobs.length === 0,
  );

  // --- Offline enablement ------------------------------------------------------

  console.log("\noffline enablement:");

  check(
    "fixturesSource.enabled() is true offline (JOBS_USE_FIXTURES not set to 0)",
    fixturesSource.enabled(),
  );

  const enabled = enabledSources();
  check(
    "OSS sources enabled when JOBS_FREE_SOURCES=1",
    remoteokSource.enabled() && arbeitnowSource.enabled() && jobicySource.enabled(),
  );

  check(
    "enabledSources() includes fixtures",
    enabled.some((s) => s.name === "fixtures"),
  );

  check(
    "enabledSources() includes OSS adapters",
    enabled.some((s) => s.name === "remoteok"),
  );

  console.log("\ndiscover() offline:");

  const discovered = await discover("engineer");
  check("discover('engineer') returns non-empty array offline", discovered.length > 0);
  check(
    "discover results include fixture-sourced jobs",
    discovered.some((j) => j.source === "fixtures"),
  );

  // --- Summary -----------------------------------------------------------------

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
