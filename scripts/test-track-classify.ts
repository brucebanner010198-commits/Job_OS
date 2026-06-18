/**
 * Self-test for email classification (Phase 6, plan §8d).
 * Pure, offline, deterministic. No LLM, no DB, no network.
 * Asserts classifyEmail reproduces every fixtureEmails[i].expectedCategory -
 * especially the 5 real-inbox NEGATIVES that contain job words but are NOT_JOB.
 * Run: npx tsx scripts/test-track-classify.ts
 */
import { classifyEmail } from "@/lib/track/classify";
import { fixtureEmails } from "@/lib/track/fixtures";

let passed = 0;
let failed = 0;

for (const fixture of fixtureEmails) {
  const result = classifyEmail(fixture.email);
  const ok = result.category === fixture.expectedCategory;
  if (ok) {
    passed++;
    console.log(
      `  ✓ ${fixture.email.gmailMessageId} → ${result.category} (${result.confidence})`,
    );
  } else {
    failed++;
    console.error(
      `  ✗ ${fixture.email.gmailMessageId}: expected ${fixture.expectedCategory}, got ${result.category}`,
    );
    console.error(`      note: ${fixture.note}`);
    console.error(`      reasons: ${JSON.stringify(result.reasons)}`);
  }
}

console.log(`\nclassify ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
