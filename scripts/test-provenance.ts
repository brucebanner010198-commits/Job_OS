/**
 * Provenance guard tests - no LLM, no DB. Proves the resume tailoring layer
 * cannot pass off fabricated content. Run: npx tsx scripts/test-provenance.ts
 */
import { auditProvenance, type SourceEntry } from "@/lib/resume/provenance";
import type { TailoredResume } from "@/lib/resume/schema";
import {
  extractMetrics,
  groundingHaystack,
  isMetricGrounded,
} from "@/lib/util/metrics";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

function resumeWithBullet(text: string, sources: string[]): TailoredResume {
  return {
    name: "Jane Doe",
    headline: "Software Engineer",
    contact: { email: "jane@example.com" },
    experience: [
      {
        title: "Software Engineer",
        company: "Acme",
        start: "01/2020",
        end: "Present",
        bullets: [{ text, sources }],
        sources,
      },
    ],
    education: [],
    skills: [],
    forJobTitle: "Software Engineer",
    forCompany: "Beta Corp",
  };
}

console.log("\nmetric grounding (boundary-aware):");
check(
  "grounded 35% passes",
  isMetricGrounded("35", groundingHaystack(["Grew revenue 35% in 2021"])),
);
check(
  "fabricated 35 does NOT match inside 21535 (substring collision rejected)",
  !isMetricGrounded("35", groundingHaystack(["Onboarded 21535 users"])),
);
check(
  "fabricated 40 does NOT match inside year 2014",
  !isMetricGrounded("40", groundingHaystack(["Joined in 2014"])),
);
check(
  "$1.2m grounded by '1.2'",
  isMetricGrounded("1.2", groundingHaystack(["Managed a $1.2m budget"])),
);
check("extractMetrics flags 35%", extractMetrics("up 35% YoY").length === 1);
check(
  "extractMetrics ignores small bare numbers",
  extractMetrics("led 3 teams").length === 0,
);

console.log("\nauditProvenance:");
const sources: SourceEntry[] = [
  { id: "e1", text: "Grew revenue 35% over two years at Acme" },
];

const ok = auditProvenance(resumeWithBullet("Increased revenue by 35%", ["e1"]), sources);
check("grounded resume passes (ok=true)", ok.ok === true);

const fabricated = auditProvenance(
  resumeWithBullet("Increased revenue by 90%", ["e1"]),
  sources,
);
check("fabricated metric blocks export (ok=false)", fabricated.ok === false);
check(
  "fabrication reported with a block violation",
  fabricated.violations.some((v) => v.severity === "block"),
);

const unknownId = auditProvenance(
  resumeWithBullet("Did good work", ["does-not-exist"]),
  sources,
);
check("unknown source id blocks export", unknownId.ok === false);

const substringCollision = auditProvenance(
  resumeWithBullet("Cut latency by 35%", ["e2"]),
  [{ id: "e2", text: "Scaled to 21535 requests/sec" }],
);
check(
  "metric matching a substring of a larger number is still blocked",
  substringCollision.ok === false,
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
