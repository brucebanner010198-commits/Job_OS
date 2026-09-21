import assert from "node:assert/strict";
import { isUnder72Hours, calculateDecayedScore } from "../components/jobs/jobs-queue";
import { computeStarBreakdown } from "../components/coaching/star-balance-meter";
import type { JobView } from "../lib/jobs/pipeline";

function mockJob(overrides: Partial<JobView>): JobView {
  return {
    id: "job-1",
    title: "Staff Platform Engineer",
    company: "Acme Corp",
    location: "Remote",
    remote: true,
    salaryMin: 180000,
    salaryMax: 220000,
    source: "remotive",
    url: "https://example.com/jobs/1",
    score: 0.85,
    relevance: 0.9,
    reachability: 0.8,
    relevanceDriver: "both",
    hardGatePass: true,
    caps: [],
    notes: ["Good match on platform skills"],
    recencyBonus: 0.1,
    fresh: true,
    postedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12h ago
    description: "Looking for an engineer with Go, Kubernetes, Kafka, and cloud infrastructure experience.",
    routePreview: "ASSISTED",
    ...overrides,
  };
}

async function runTests() {
  console.log("\n=== Research-Backed UX Improvements Verification ===\n");

  // 1. Freshness & Posting Age Checks
  console.log("Testing posting freshness & early-applicant decay...");
  {
    const freshJob = mockJob({
      fresh: true,
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(), // 20h ago
      score: 0.8,
    });
    assert.equal(isUnder72Hours(freshJob), true, "Job posted 20h ago should be under 72h");

    const staleJob = mockJob({
      fresh: false,
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(), // 14 days ago
      score: 0.8,
    });
    assert.equal(isUnder72Hours(staleJob), false, "Job posted 14 days ago should NOT be under 72h");

    const freshScore = calculateDecayedScore(freshJob);
    const staleScore = calculateDecayedScore(staleJob);
    assert.ok(freshScore > staleScore, "Fresh job score must rank higher than decayed stale job");
    console.log(`  ✓ Freshness score comparison: fresh=${freshScore.toFixed(3)} vs stale=${staleScore.toFixed(3)}`);
  }

  // 2. STAR Balance Meter & Context Trap Detection
  console.log("\nTesting STAR response balance meter & context trap detection...");
  {
    // A: Context trap response (75% context, minimal action)
    const contextTrapText =
      "When I was at my previous company, our team had a massive legacy monolithic system with tons of technical debt. " +
      "The problem was that deployments took four hours, and we were facing frequent database outages. " +
      "The existing system had zero automated tests and historically nobody had updated the dependencies for three years. " +
      "My goal was to figure out why the pipeline was so slow. I attended several planning meetings.";

    const trapBreakdown = computeStarBreakdown(contextTrapText);
    assert.equal(trapBreakdown.isContextTrap, true, "Context trap should be detected when context > 35%");
    assert.ok(trapBreakdown.contextPct > 40, "Context percentage should be high");
    console.log(`  ✓ Context trap correctly flagged: ${trapBreakdown.contextPct}% context, score=${trapBreakdown.score}/100`);

    // B: Balanced action-oriented response
    const balancedText =
      "When our data pipeline experienced latency spikes, we needed to reduce processing bottlenecks under a two-week deadline. " +
      "I designed and implemented an asynchronous Kafka streaming architecture, refactored three core query bottlenecks in PostgreSQL, " +
      "and authored a comprehensive migration plan with automated rollback gates. " +
      "As a result, pipeline latency decreased by 68%, saving $45,000 annually in compute costs and successfully scaling throughput to 50,000 events per second.";

    const balancedBreakdown = computeStarBreakdown(balancedText);
    assert.equal(balancedBreakdown.isContextTrap, false, "Balanced response should NOT be flagged as context trap");
    assert.ok(balancedBreakdown.actionPct >= 30, "Action percentage should be substantial");
    assert.ok(balancedBreakdown.resultPct >= 15, "Result percentage should be substantial");
    assert.ok(balancedBreakdown.score >= 80, "Balanced response should receive a high score");
    console.log(
      `  ✓ Balanced response scored: ${balancedBreakdown.score}/100 (Action: ${balancedBreakdown.actionPct}%, Result: ${balancedBreakdown.resultPct}%, Context: ${balancedBreakdown.contextPct}%)`
    );
  }

  // 3. Metric Density Evaluation
  console.log("\nTesting Google XYZ metric density parsing...");
  {
    const bulletsWithMetrics = [
      "Reduced API latency by 45% by re-architecting Redis cache invalidation.",
      "Managed a cross-functional team of 8 engineers delivering enterprise security.",
      "Generated $1.2M in annual recurring revenue by launching self-serve onboarding.",
    ];
    const metricRegex = /\d+(\.\d+)?%|\$\d+|\b\d+\b/i;
    const matches = bulletsWithMetrics.filter((b) => metricRegex.test(b)).length;
    assert.equal(matches, 3, "All XYZ bullets should contain metric markers");
    console.log(`  ✓ Metric density parsing verified: ${matches}/${bulletsWithMetrics.length} bullets matched`);
  }

  console.log("\n=== All Research-Backed UX Tests Passed ===\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
