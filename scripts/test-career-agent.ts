/**
 * Career content agent tests - pure staleness/polish logic + scheduler catalog.
 * Run: npm run test:career-agent
 */
import { ProfileEntryKind, type ProfileEntry } from "@prisma/client";
import {
  needsPolish,
  validatePolishedBullets,
  BULLET_POLISH_VERSION,
} from "@/lib/profile/polish";
import {
  isContentStale,
  isTargetResumeStale,
  isTargetCoverStale,
} from "@/lib/career/staleness";
import { JOB_SPECS, type JobKind } from "@/lib/scheduler/types";

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

function entry(
  overrides: {
    kind: ProfileEntryKind;
    data: ProfileEntry["data"];
    sensitive?: boolean;
  },
): ProfileEntry {
  return {
    id: "e1",
    userId: "u1",
    profileId: "p1",
    sourceNote: null,
    sensitive: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

console.log("\ncareer-agent - needsPolish:");
check(
  "true when bulletPolish missing",
  needsPolish(
    entry({
      kind: ProfileEntryKind.EXPERIENCE,
      data: { bullets: ["Led migration, cut latency 40%"] },
    }),
  ),
);
check(
  "true when bulletPolish version stale",
  needsPolish(
    entry({
      kind: ProfileEntryKind.EXPERIENCE,
      data: {
        bullets: ["Led migration"],
        bulletPolish: { version: 0, polishedAt: "2020-01-01", frameworks: ["car"] },
      },
    }),
  ),
);
check(
  "false when bulletPolish version current",
  !needsPolish(
    entry({
      kind: ProfileEntryKind.EXPERIENCE,
      data: {
        bullets: ["Led migration"],
        bulletPolish: {
          version: BULLET_POLISH_VERSION,
          polishedAt: "2026-01-01",
          frameworks: ["car"],
        },
      },
    }),
  ),
);
check(
  "false for sensitive entry",
  !needsPolish(
    entry({
      kind: ProfileEntryKind.EXPERIENCE,
      sensitive: true,
      data: { bullets: ["Secret work"] },
    }),
  ),
);
check(
  "false for LIFE_FACT",
  !needsPolish(
    entry({
      kind: ProfileEntryKind.LIFE_FACT,
      data: { text: "personal" },
    }),
  ),
);
check(
  "false when no bullets",
  !needsPolish(
    entry({
      kind: ProfileEntryKind.PROJECT,
      data: { name: "Side project" },
    }),
  ),
);

console.log("\ncareer-agent - isContentStale:");
const wm = new Date("2026-06-18T12:00:00.000Z");
const older = new Date("2026-06-17T12:00:00.000Z");
const newer = new Date("2026-06-19T12:00:00.000Z");
check("null profile watermark → not stale", !isContentStale(null, older));
check("never generated → stale", isContentStale(wm, null));
check("profile newer → stale", isContentStale(wm, older));
check("profile older → not stale", !isContentStale(older, wm));
check(
  "resume stale when never generated",
  isTargetResumeStale(wm, null),
);
check(
  "cover stale when profile newer",
  isTargetCoverStale(wm, {
    id: "c1",
    userId: "u1",
    profileId: "p1",
    targetId: "t1",
    body: "Hi",
    wordCount: 1,
    provenanceOk: true,
    createdAt: older,
  }),
);

console.log("\ncareer-agent - validatePolishedBullets:");
check(
  "accepts grounded metric",
  validatePolishedBullets(
    ["Led payments migration, cut latency 40%"],
    ["Cut checkout latency 40% by leading payments rewrite"],
  ).ok,
);
check(
  "rejects invented metric",
  !validatePolishedBullets(
    ["improved performance on the platform"],
    ["Drove 40% improvement in platform performance"],
  ).ok,
);

console.log("\ncareer-agent - scheduler catalog:");
check(
  "JOB_SPECS includes refresh-career-content",
  JOB_SPECS.some((s) => s.kind === "refresh-career-content"),
);
const kinds = new Set(JOB_SPECS.map((s) => s.kind));
const allKinds: JobKind[] = [
  "gmail-sync",
  "discover-jobs",
  "refresh-followups",
  "refresh-career-content",
];
check(
  "JOB_SPECS covers every JobKind",
  allKinds.every((k) => kinds.has(k)),
);

console.log(`\ncareer-agent ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
