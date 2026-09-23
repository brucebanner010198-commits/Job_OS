import "./lib/use-test-database";
/**
 * Handoff gate (test database).
 *
 * Proves: an application the driver filled but did not send sits in HANDOFF
 * without counting as applied, and only the user's confirmation marks it
 * APPLIED. Confirming anything not in HANDOFF is refused.
 *
 * Run: npx tsx scripts/test-apply-handoff.ts
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { confirmSubmittedByUser } from "@/lib/apply/service";

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

async function main() {
  const tag = randomUUID().slice(0, 8);
  const user = await db.user.create({ data: { email: `handoff-${tag}@test.local` } });
  const profile = await db.profile.create({ data: { userId: user.id, name: "handoff test" } });
  const scope = { userId: user.id, profileId: profile.id };
  const job = await db.job.create({
    data: { ...scope, identityHash: `handoff-${tag}`, source: "test", company: "Test Co", title: "Engineer" },
  });
  const app = await db.application.create({ data: { ...scope, jobId: job.id, applyState: "HANDOFF" } });

  try {
    check("handed-off application is not counted as applied", app.status !== "APPLIED" && !app.submittedAt);

    const first = await confirmSubmittedByUser(scope, app.id);
    const after = await db.application.findUniqueOrThrow({ where: { id: app.id } });
    check("user confirmation moves HANDOFF → SUBMITTED", first.ok && after.applyState === "SUBMITTED");
    check("…and marks it APPLIED with a submit time", after.status === "APPLIED" && after.submittedAt !== null);

    const second = await confirmSubmittedByUser(scope, app.id);
    check("confirming again is refused (not in HANDOFF)", !second.ok && second.state === "SUBMITTED");

    const events = await db.applicationEvent.count({ where: { applicationId: app.id, type: "submitted" } });
    check("exactly one submitted event is recorded", events === 1);
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
