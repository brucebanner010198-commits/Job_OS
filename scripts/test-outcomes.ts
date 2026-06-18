/**
 * Self-test for Phase 9 (harden + schedule). THIS IS THE test:outcomes gate.
 * Pure, offline, deterministic - a constant NOW is injected, so nothing depends
 * on the wall clock. Two halves:
 *   A. Outcome-KPI brain - funnel, per-lane verdicts (flag the weak lane),
 *      speed-to-apply, recommendations, determinism, empty-input safety.
 *   B. Catch-up scheduler - due/not-due planning, watermark idempotency (run once,
 *      don't double-run, missed jobs still due), launchd plist render, preview.
 * Run: npx tsx scripts/test-outcomes.ts
 */
import { computeKpis } from "@/lib/metrics/compute";
import {
  fixtureMetricsInput,
  FIXTURE_NOW as M_NOW,
  EXPECTED,
} from "@/lib/metrics/fixtures";
import type { LaneMetrics, MetricsView } from "@/lib/metrics/types";
import { previewMetrics } from "@/lib/metrics/pipeline";

import {
  jobsFromWatermarks,
  planRun,
  nextRunState,
  humanizeDuration,
} from "@/lib/scheduler/plan";
import {
  buildLaunchdConfig,
  renderLaunchdPlist,
  launchdInstall,
} from "@/lib/scheduler/launchd";
import { pushRelayStatus } from "@/lib/scheduler/push-relay";
import { previewOps } from "@/lib/scheduler/pipeline";
import {
  fixtureWatermarks,
  FIXTURE_NOW as S_NOW,
  EXPECTED_DUE,
} from "@/lib/scheduler/fixtures";
import type { RunReceipt } from "@/lib/scheduler/types";

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

const lane = (v: MetricsView, k: "cold" | "warm"): LaneMetrics =>
  v.lanes.find((l) => l.lane === k)!;

// ===========================================================================
// A. OUTCOME-KPI BRAIN
// ===========================================================================

const view = computeKpis(fixtureMetricsInput, M_NOW);

console.log("\noutcomes - funnel (submitted only; SKIPPED + pipeline excluded):");
check(`pipeline = ${EXPECTED.funnel.pipeline}`, view.funnel.pipeline === EXPECTED.funnel.pipeline);
check(`applied = ${EXPECTED.funnel.applied}`, view.funnel.applied === EXPECTED.funnel.applied);
check(`interviewing = ${EXPECTED.funnel.interviewing}`, view.funnel.interviewing === EXPECTED.funnel.interviewing);
check(`offer = ${EXPECTED.funnel.offer}`, view.funnel.offer === EXPECTED.funnel.offer);
check(`rejected = ${EXPECTED.funnel.rejected}`, view.funnel.rejected === EXPECTED.funnel.rejected);
check(
  "SKIPPED counts toward nothing (13 applied, not 14)",
  view.funnel.applied === 13,
);

console.log("\noutcomes - headline KPI (interviews per 10 apps):");
check(`totalApplications = 13`, view.headline.totalApplications === EXPECTED.headline.totalApplications);
check(`totalInterviews = 4`, view.headline.totalInterviews === EXPECTED.headline.totalInterviews);
check(`totalOffers = 1`, view.headline.totalOffers === EXPECTED.headline.totalOffers);
check(
  `interviewsPer10Apps = ${EXPECTED.headline.interviewsPer10Apps}`,
  view.headline.interviewsPer10Apps === EXPECTED.headline.interviewsPer10Apps,
);
check("offerRate ≈ 1/13 (> 0)", view.headline.offerRate > 0 && view.headline.offerRate < 0.1);
check("interviewRate in (0,1)", view.headline.interviewRate > 0 && view.headline.interviewRate < 1);

console.log("\noutcomes - per-lane verdicts (THE feature: flag a weak lane):");
const cold = lane(view, "cold");
const warm = lane(view, "warm");
check(`cold applications = ${EXPECTED.cold.applications}`, cold.applications === EXPECTED.cold.applications);
check(`cold interviews = ${EXPECTED.cold.interviews}`, cold.interviews === EXPECTED.cold.interviews);
check(`cold per10 = ${EXPECTED.cold.interviewsPer10Apps}`, cold.interviewsPer10Apps === EXPECTED.cold.interviewsPer10Apps);
check("cold verdict = underperforming", cold.verdict === EXPECTED.cold.verdict);
check("cold recommendation mentions the warm-path shift", !!cold.recommendation && /warm-path/i.test(cold.recommendation));
check(`warm applications = ${EXPECTED.warm.applications}`, warm.applications === EXPECTED.warm.applications);
check(`warm interviews = ${EXPECTED.warm.interviews}`, warm.interviews === EXPECTED.warm.interviews);
check(`warm offers = ${EXPECTED.warm.offers}`, warm.offers === EXPECTED.warm.offers);
check(`warm per10 = ${EXPECTED.warm.interviewsPer10Apps}`, warm.interviewsPer10Apps === EXPECTED.warm.interviewsPer10Apps);
check("warm verdict = converting", warm.verdict === EXPECTED.warm.verdict);
check("converting lane carries no recommendation", warm.recommendation === undefined);
check("the two lanes get DIFFERENT verdicts (weak lane is flagged)", cold.verdict !== warm.verdict);
check("offers never exceed interviews in a lane (offer ⇒ interviewed)", warm.offers <= warm.interviews);

console.log("\noutcomes - speed-to-apply (the ~8× lever):");
check(`speed sampleSize = ${EXPECTED.speed.sampleSize}`, view.speed.sampleSize === EXPECTED.speed.sampleSize);
check(`speed medianHours = ${EXPECTED.speed.medianHours}`, view.speed.medianHours === EXPECTED.speed.medianHours);
check("speed verdict = slow", view.speed.verdict === EXPECTED.speed.verdict);

console.log("\noutcomes - practice (mock-interview reps, secondary):");
check(`practice sessions = ${EXPECTED.practice.sessions}`, view.practice.sessions === EXPECTED.practice.sessions);
check(`practice liveSessions = ${EXPECTED.practice.liveSessions}`, view.practice.liveSessions === EXPECTED.practice.liveSessions);
check(`practice avgScore = ${EXPECTED.practice.avgScore}`, view.practice.avgScore === EXPECTED.practice.avgScore);

console.log("\noutcomes - recommendations lead with what to do next:");
const recs = view.recommendations.join(" || ");
check("recommends the salary coach for the offer in hand", /offer/i.test(recs) && /salary coach/i.test(recs));
check("recommends shifting to the warm-path lane", /warm-path/i.test(recs));
check("recommends applying faster (the 24–48h / 8× lever)", /8×|24–48h|fresh/i.test(recs));
check("at least 3 recommendations", view.recommendations.length >= 3);

console.log("\noutcomes - determinism + provenance bounds:");
check("generatedAt echoes the injected now", view.generatedAt === M_NOW);
check(
  "same input ⇒ identical view (deterministic)",
  JSON.stringify(computeKpis(fixtureMetricsInput, M_NOW)) ===
    JSON.stringify(computeKpis(fixtureMetricsInput, M_NOW)),
);
check(
  "every per-10 figure is within [0,10]",
  view.lanes.every((l) => l.interviewsPer10Apps >= 0 && l.interviewsPer10Apps <= 10),
);
check(
  "previewMetrics() equals the fixture compute (offline preview = test value)",
  JSON.stringify(previewMetrics()) === JSON.stringify(view),
);

console.log("\noutcomes - empty pipeline is safe + honest:");
const empty = computeKpis({ applications: [], interviews: [] }, M_NOW);
check("no applications ⇒ applied = 0", empty.funnel.applied === 0);
check("no applications ⇒ headline per10 = 0", empty.headline.interviewsPer10Apps === 0);
check("both lanes insufficient-data", empty.lanes.every((l) => l.verdict === "insufficient-data"));
check(
  "recommends starting at the top of the funnel",
  empty.recommendations.some((r) => /no applications submitted/i.test(r)),
);

// ===========================================================================
// B. CATCH-UP SCHEDULER
// ===========================================================================

const jobs = jobsFromWatermarks(fixtureWatermarks);

console.log("\nscheduler - every catalog job appears, merged with its watermark:");
check("5 jobs (gmail-sync, discover-jobs, refresh-followups, refresh-career-content, autopilot-cycle)", jobs.length === 5);
check(
  "kinds match the catalog",
  jobs.map((j) => j.kind).sort().join(",") ===
    "autopilot-cycle,discover-jobs,gmail-sync,refresh-career-content,refresh-followups",
);

const plan = planRun(jobs, S_NOW);

console.log("\nscheduler - planning: catch up missed jobs, skip recent ones:");
check(
  `dueKinds = [${EXPECTED_DUE.join(", ")}]`,
  plan.dueKinds.slice().sort().join(",") === EXPECTED_DUE.slice().sort().join(","),
);
check("discover-jobs is NOT due (ran 1h ago, interval 6h)", !plan.dueKinds.includes("discover-jobs"));
const dGmail = plan.decisions.find((d) => d.kind === "gmail-sync")!;
const dDiscover = plan.decisions.find((d) => d.kind === "discover-jobs")!;
const dFollow = plan.decisions.find((d) => d.kind === "refresh-followups")!;
check("never-run job is due", dGmail.due && /not yet run/i.test(dGmail.reason));
check("recent job reason mentions 'next in'", !dDiscover.due && /next in/i.test(dDiscover.reason));
check("overdue job reason mentions 'overdue' + has overdueSec > 0", dFollow.due && /overdue/i.test(dFollow.reason) && dFollow.overdueSec > 0);

console.log("\nscheduler - watermark idempotency (run once; missed stays due):");
// Run gmail-sync at NOW; re-plan with the SAME now.
const receipt: RunReceipt = { kind: "gmail-sync", ranAtIso: S_NOW, status: "ok", detail: "created 2" };
const advanced = jobs.map((j) => (j.kind === "gmail-sync" ? nextRunState(j, receipt) : j));
const replan = planRun(advanced, S_NOW);
check("a just-run job is no longer due (no double-run)", !replan.dueKinds.includes("gmail-sync"));
check("gmail-sync run count incremented", advanced.find((j) => j.kind === "gmail-sync")!.runs === 1);
check("a still-unrun overdue job stays due (missed work isn't lost)", replan.dueKinds.includes("refresh-followups"));
check(
  "planning is pure: re-planning the original twice is identical",
  JSON.stringify(planRun(jobs, S_NOW)) === JSON.stringify(planRun(jobs, S_NOW)),
);

console.log("\nscheduler - humanizeDuration:");
check("45s", humanizeDuration(45) === "45s");
check("2m (90s)", humanizeDuration(90) === "2m");
check("1h", humanizeDuration(3600) === "1h");
check("2d", humanizeDuration(172800) === "2d");

console.log("\nscheduler - launchd agent renders correctly (RunAtLoad = catch up on wake):");
const cfg = buildLaunchdConfig({ workingDirectory: "/Users/you/Job & OS" });
const plist = renderLaunchdPlist(cfg);
check("well-formed plist (xml header + closing tag)", plist.startsWith("<?xml") && plist.trimEnd().endsWith("</plist>"));
check("RunAtLoad is true (fires on wake)", /<key>RunAtLoad<\/key>\s*<true\/>/.test(plist));
check("has a StartInterval", /<key>StartInterval<\/key>\s*<integer>\d+<\/integer>/.test(plist));
check("carries the agent label", plist.includes("com.jobos.catchup"));
check("runs through a login shell (PATH-safe)", plist.includes("/bin/sh"));
check("XML-escapes the working directory ('&' ⇒ '&amp;')", plist.includes("Job &amp; OS") && !/Job & OS/.test(plist));
const install = launchdInstall(cfg);
check("install steps include launchctl load", install.some((c) => /launchctl load/.test(c)));

console.log("\nscheduler - push-relay seam (optional; off by default):");
const relay = pushRelayStatus();
check("provider is a known value", relay.provider === "none" || relay.provider === "gmail-pubsub");
check("detail is non-empty", relay.detail.trim().length > 0);
if (!process.env.GMAIL_PUBSUB_TOPIC) {
  check("no topic configured ⇒ provider 'none' (polling on wake)", relay.provider === "none" && !relay.configured);
}

console.log("\nscheduler - offline preview (the /outcomes Automation panel):");
const ops = previewOps();
check("preview has all 5 jobs", ops.jobs.length === 5);
check("preview plan flags the same due jobs", ops.plan.dueKinds.slice().sort().join(",") === EXPECTED_DUE.slice().sort().join(","));
check("preview renders a launchd plist", ops.launchd.plist.includes("</plist>"));
check("preview exposes install steps", ops.launchd.install.length > 0);
check("preview reports the push-relay status", ops.pushRelay.detail.trim().length > 0);

// ===========================================================================

console.log(`\noutcomes ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
