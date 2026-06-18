/**
 * Integration gate for Phase 8 (Interview Prep) - THE test:interview gate.
 * Pure, offline, deterministic: a constant FIXTURE_NOW is injected, so nothing
 * depends on the wall clock. It exercises all four brains (study, persona, guard,
 * score) and the pure pipeline through the real contract + fixtures, and pins the
 * safety invariants: extractive study, sensitive-fact withholding, distinct
 * personas with no sensitive leak, the cost-cap kill-switch, and a deterministic
 * scorer that ranks a STAR answer far above a vague one.
 * Run: npx tsx scripts/test-interview.ts
 */
import { buildStudyGuide } from "@/lib/interview/study";
import { buildPersona, buildPersonas } from "@/lib/interview/persona";
import { dayKey, decideStart, tickSession } from "@/lib/interview/guard";
import { scoreSession } from "@/lib/interview/score";
import { previewInterview } from "@/lib/interview/pipeline";
import {
  DEFAULT_VOICE_CAPS,
  STUDY_QUESTION_TARGET,
  type AgentPersona,
} from "@/lib/interview/types";
import {
  FIXTURE_NOW,
  fixtureFacts,
  fixturePrep,
  fixturePreps,
  fixtureStrongTranscript,
  fixtureWeakTranscript,
  fixtureUsageAtCap,
  fixtureUsageFresh,
  fixtureUsageOver,
  fixtureUsageUnder,
} from "@/lib/interview/fixtures";

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

const SENSITIVE = "chronic health condition";
const caps = DEFAULT_VOICE_CAPS;
/** Shift an injected instant by N seconds → ISO (test-only clock arithmetic). */
const shift = (iso: string, sec: number): string =>
  new Date(Date.parse(iso) + sec * 1000).toISOString();

// --- 1. Study: extractive, grounded, 5 questions, sensitive withheld ---------

console.log("\ninterview - study guide is extractive + grounded:");
for (const f of fixturePreps) {
  const g = buildStudyGuide(f.prep);
  const tag = f.prep.company;
  check(`${tag}: exactly ${STUDY_QUESTION_TARGET} questions`, g.questions.length === STUDY_QUESTION_TARGET);
  check(
    `${tag}: spans ≥4 distinct categories`,
    new Set(g.questions.map((q) => q.category)).size >= 4,
  );
  check(`${tag}: provenanceOk === expectGrounded (${f.expectGrounded})`, g.provenanceOk === f.expectGrounded);

  const realIds = new Set(f.prep.facts.filter((x) => !x.sensitive).map((x) => x.id));
  const everyUsedReal = g.questions.every((q) => q.usedFactIds.every((id) => realIds.has(id)));
  check(`${tag}: every usedFactId is a real non-sensitive fact`, everyUsedReal);

  const blob = JSON.stringify(g).toLowerCase();
  check(`${tag}: no sensitive fact text leaks`, !blob.includes(SENSITIVE));

  const sensitiveCount = f.prep.facts.filter((x) => x.sensitive).length;
  check(`${tag}: withheldSensitive === ${sensitiveCount}`, g.withheldSensitive === sensitiveCount);
}

// Grounded prep must surface a real metric drawn from the facts.
const grounded = buildStudyGuide(fixturePrep);
const allAnswers = grounded.questions.map((q) => q.modelAnswer).join(" ");
check(
  "grounded guide quotes a real metric from the facts (40% / $20M / 5M)",
  /40%|\$20M|5M/.test(allAnswers),
);
// No-facts prep still emits a usable (ungrounded) guide.
const bare = buildStudyGuide(fixturePreps[2].prep);
check("no-facts prep still emits 5 questions but provenanceOk=false", bare.questions.length === 5 && !bare.provenanceOk);

// --- 2. Persona: two distinct live personas, no sensitive leak ---------------

console.log("\ninterview - personas are distinct + grounded + clean:");
const aiScreen = buildPersona("AI_SCREEN", fixturePrep);
const realHr = buildPersona("REAL_HR", fixturePrep);
check("AI_SCREEN vs REAL_HR use different agentIdEnv", aiScreen.agentIdEnv !== realHr.agentIdEnv);
check("REAL_HR warmth > AI_SCREEN warmth", realHr.warmth > aiScreen.warmth);
check("personas have different names + openers", aiScreen.name !== realHr.name && aiScreen.opener !== realHr.opener);
const grounds = (p: AgentPersona) =>
  p.systemPrompt.includes(fixturePrep.company) && Boolean(fixturePrep.role) && p.systemPrompt.includes(fixturePrep.role!);
check("AI_SCREEN systemPrompt grounded in company + role", grounds(aiScreen));
check("REAL_HR systemPrompt grounded in company + role", grounds(realHr));
const noLeak = (p: AgentPersona) => !JSON.stringify(p).toLowerCase().includes(SENSITIVE);
check("no sensitive fact in either persona", noLeak(aiScreen) && noLeak(realHr));
const two = buildPersonas(fixturePrep);
check("buildPersonas returns the 2 live personas", two.length === 2 && new Set(two.map((p) => p.mode)).size === 2);
let studyOk = true;
try {
  buildPersona("STUDY", fixturePrep);
} catch {
  studyOk = false;
}
check("buildPersona(STUDY) is total (never throws)", studyOk);

// --- 3. Guard: day key + daily kill-switch + session ticks -------------------

console.log("\ninterview - cost-cap guard (kill-switch + ticks):");
check('dayKey("2026-06-16T12:00:00.000Z") === "2026-06-16"', dayKey(FIXTURE_NOW) === "2026-06-16");

const fresh = decideStart(caps, fixtureUsageFresh);
check("fresh day → allowed, grantedSec === maxSessionSec", fresh.allowed && fresh.grantedSec === caps.maxSessionSec);
check("at-cap day → blocked, grantedSec 0 (kill-switch)", !decideStart(caps, fixtureUsageAtCap).allowed && decideStart(caps, fixtureUsageAtCap).grantedSec === 0);
check("over-cap day → blocked", !decideStart(caps, fixtureUsageOver).allowed);
const under = decideStart(caps, fixtureUsageUnder);
check(
  "under-cap day → grantedSec === min(maxSession, dailyRemaining)",
  under.grantedSec === Math.min(caps.maxSessionSec, caps.dailyCapSec - fixtureUsageUnder.secondsUsed),
);

const granted = fresh.grantedSec;
const started = FIXTURE_NOW;
check(
  "tick at start → continue",
  tickSession(granted, caps, started, started, started).action === "continue",
);
check(
  "tick idle ≥ idleHangupSec → idle_hangup",
  tickSession(granted, caps, started, started, shift(started, caps.idleHangupSec + 5)).action === "idle_hangup",
);
check(
  "tick elapsed ≥ grantedSec → hangup",
  tickSession(granted, caps, started, shift(started, granted), shift(started, granted + 1)).action === "hangup",
);
{
  // Near the limit, but still active (recent activity) → warn.
  const nowNearEnd = shift(started, granted - Math.floor(caps.warnAtRemainingSec / 2));
  const recent = shift(nowNearEnd, -1);
  check("tick near limit (active) → warn", tickSession(granted, caps, started, recent, nowNearEnd).action === "warn");
}

// --- 4. Score: strong STAR answer ranks far above a vague ramble -------------

console.log("\ninterview - deterministic scoring:");
const strong = scoreSession(fixtureStrongTranscript, "AI_SCREEN", fixturePrep);
const weak = scoreSession(fixtureWeakTranscript, "AI_SCREEN", fixturePrep);
const inRange = (s: { clarity: number; structure: number; specificity: number; fit: number; overall: number }) =>
  [s.clarity, s.structure, s.specificity, s.fit, s.overall].every((n) => n >= 0 && n <= 100);
check("all sub-scores within 0..100 (strong + weak)", inRange(strong) && inRange(weak));
check("strong.structure > weak.structure + 20", strong.structure > weak.structure + 20);
check("strong.specificity > weak.specificity + 20", strong.specificity > weak.specificity + 20);
check("strong.overall > weak.overall", strong.overall > weak.overall);
check("weak answer yields STAR fixes", weak.starFixes.length > 0);
check('weak answer flags "filler"', weak.flags.includes("filler"));
check('strong answer flags "specific" or "strong STAR"', strong.flags.includes("specific") || strong.flags.includes("strong STAR"));
check(
  "scoring is deterministic (same input → same output)",
  JSON.stringify(scoreSession(fixtureStrongTranscript, "AI_SCREEN", fixturePrep)) === JSON.stringify(strong),
);

// --- 5. Pipeline: offline preview board is populated -------------------------

console.log("\ninterview - offline preview board:");
const board = previewInterview();
check("preview board has ≥1 prep", board.preps.length >= 1);
check("every prep carries a 5-question guide", board.preps.every((p) => p.guide.questions.length === STUDY_QUESTION_TARGET));
check("at least one prep was surfaced from a Gmail invite", board.preps.some((p) => p.fromInvite));
check("board reports voice status + caps + daily budget", Boolean(board.voice) && board.caps.maxSessionSec > 0 && board.dailyRemainingSec >= 0);
check("preview never leaks a sensitive fact", !JSON.stringify(board).toLowerCase().includes(SENSITIVE));

// --- Summary -----------------------------------------------------------------

console.log(`\ninterview ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
