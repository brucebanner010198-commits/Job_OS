/**
 * Test offline coaching session processor and extraction.
 * Run: npx tsx scripts/test-coaching-session.ts
 */
import {
  extractCoachingSessionHeuristic,
  coachingSessionInsightsSchema,
} from "@/lib/coaching/session-processor";

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

async function main() {
  console.log("\n=== Coaching Session Capture & Processing Tests ===\n");

  const sampleTranscript = `
Today I finished rewriting our payments service in Go and Postgres.
We cut p95 checkout latency by 40% and reduced checkout error rates by 25%.
I decided to use an event-driven architecture with Kafka to decouple payment authorizations from order fulfillment.
We also added Docker containerization and set up automated CI/CD deployment pipelines on AWS.
Tomorrow I plan to follow up on Prometheus monitoring and write end-to-end integration tests.
  `.trim();

  // 1. Test heuristic extraction
  const insights = extractCoachingSessionHeuristic(sampleTranscript);

  check("title is populated", typeof insights.title === "string" && insights.title.length > 0);
  check("summary is populated", typeof insights.summary === "string" && insights.summary.length > 0);
  check("category detected as ARCHITECTURE or FEATURE", ["ARCHITECTURE", "FEATURE"].includes(insights.category));
  check("achievements extracted", insights.achievements.length >= 1);
  check("metrics captured in achievements", insights.achievements.some((a) => a.metric && (a.metric.includes("40%") || a.metric.includes("25%"))));
  check("technical decisions extracted", insights.technicalDecisions.length > 0);
  check("skills extracted (Go, Postgres, Kafka, Docker, AWS)", insights.skills.some((s) => ["Go", "Postgres", "Kafka", "Docker", "AWS"].includes(s)));
  check("coaching notes generated", insights.coachingNotes.length > 0);
  check("action items extracted", insights.actionItems.length > 0);

  // 2. Test Zod schema validation
  const validation = coachingSessionInsightsSchema.safeParse(insights);
  check("insights match Zod schema", validation.success);

  // 3. Category detection test cases
  const archTranscript = "I led the architecture design review for our new distributed cache and decided to use Redis clustering.";
  const archInsights = extractCoachingSessionHeuristic(archTranscript);
  check("architecture category detected", archInsights.category === "ARCHITECTURE");

  const bugTranscript = "Resolved a critical production incident and fixed the memory leak in the background worker.";
  const bugInsights = extractCoachingSessionHeuristic(bugTranscript);
  check("bugfix category detected", bugInsights.category === "BUGFIX");

  const leadershipTranscript = "I mentored two junior software engineers and led the team sprint planning meeting.";
  const leadershipInsights = extractCoachingSessionHeuristic(leadershipTranscript);
  check("leadership category detected", leadershipInsights.category === "LEADERSHIP");

  console.log(`\n=== Done: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
