/**
 * Self-test for the cost-cap / session-guard BRAIN (Phase 8, plan §5).
 * THIS IS THE test:interview-guard gate. Pure, offline, deterministic: every
 * instant is an injected ISO string built off FIXTURE_NOW, so nothing depends on
 * the wall clock. It proves the kill-switch (daily cap), the per-session ceiling,
 * idle auto-hangup, and the warn threshold all fire on the right inputs.
 * Run: npx tsx scripts/test-interview-guard.ts
 */
import { dayKey, decideStart, tickSession } from "@/lib/interview/guard";
import {
  fixtureUsageAtCap,
  fixtureUsageFresh,
  fixtureUsageOver,
  fixtureUsageUnder,
  FIXTURE_NOW,
} from "@/lib/interview/fixtures";
import { DEFAULT_VOICE_CAPS } from "@/lib/interview/types";

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

const caps = DEFAULT_VOICE_CAPS;
const started = FIXTURE_NOW;

/** `iso` shifted forward by `sec` seconds, re-serialized to ISO. */
function addSec(iso: string, sec: number): string {
  return new Date(Date.parse(iso) + sec * 1000).toISOString();
}

// --- 1. dayKey: UTC calendar day of an instant -------------------------------

console.log("\nguard - dayKey is the UTC calendar day of the instant:");
check(
  'dayKey("2026-06-16T12:00:00.000Z") === "2026-06-16"',
  dayKey("2026-06-16T12:00:00.000Z") === "2026-06-16",
);
check(
  "dayKey(FIXTURE_NOW) === \"2026-06-16\"",
  dayKey(FIXTURE_NOW) === "2026-06-16",
);

// --- 2. decideStart: per-session ceiling + daily kill-switch ------------------

console.log("\nguard - decideStart grants the per-session budget when fresh:");
const fresh = decideStart(caps, fixtureUsageFresh);
check(
  "fresh day → allowed and grantedSec === maxSessionSec",
  fresh.allowed === true && fresh.grantedSec === caps.maxSessionSec,
);
check(
  "fresh day → dailyRemainingSec === dailyCapSec",
  fresh.dailyRemainingSec === caps.dailyCapSec,
);

console.log("\nguard - decideStart kill-switch blocks at/over the daily cap:");
const atCap = decideStart(caps, fixtureUsageAtCap);
check(
  "exactly at cap → blocked and grantedSec === 0 (kill-switch)",
  atCap.allowed === false && atCap.grantedSec === 0,
);
check(
  "exactly at cap → dailyRemainingSec === 0",
  atCap.dailyRemainingSec === 0,
);
const over = decideStart(caps, fixtureUsageOver);
check(
  "over cap → blocked (negative remaining clamped to 0)",
  over.allowed === false && over.grantedSec === 0,
);

console.log("\nguard - decideStart clamps the grant to the day's remainder:");
const under = decideStart(caps, fixtureUsageUnder);
check(
  "under cap → grantedSec === min(maxSessionSec, dailyCapSec - 600)",
  under.allowed === true &&
    under.grantedSec ===
      Math.min(caps.maxSessionSec, caps.dailyCapSec - 600),
);

// --- 3. tickSession: priority-ordered live decisions -------------------------
// Granted the full per-session budget; instants are built off the injected
// `started` so every tick is deterministic.

const grantedSec = caps.maxSessionSec;

console.log("\nguard - tickSession at session start continues:");
const tickStart = tickSession(grantedSec, caps, started, started, started);
check(
  "now == started, lastActivity == started → continue",
  tickStart.action === "continue" &&
    tickStart.elapsedSec === 0 &&
    tickStart.remainingSec === grantedSec,
);

console.log("\nguard - tickSession idle auto-hangup:");
// Idle 50s (>= idleHangupSec 45) but only 50s elapsed → budget not yet spent.
const idleNow = addSec(started, caps.idleHangupSec + 5);
const tickIdle = tickSession(grantedSec, caps, started, started, idleNow);
check(
  "idle >= idleHangupSec (budget left) → idle_hangup",
  tickIdle.action === "idle_hangup" && tickIdle.remainingSec > 0,
);

console.log("\nguard - tickSession hard hangup on spent budget:");
// Elapsed == grantedSec → remaining 0. lastActivity == now so idle can't win.
const overNow = addSec(started, grantedSec);
const tickHangup = tickSession(grantedSec, caps, started, overNow, overNow);
check(
  "elapsed >= grantedSec → hangup (outranks idle)",
  tickHangup.action === "hangup" && tickHangup.remainingSec === 0,
);

console.log("\nguard - tickSession warns near the end:");
// Elapsed so that 0 < remaining <= warnAtRemainingSec; lastActivity == now (not idle).
const warnElapsed = grantedSec - Math.floor(caps.warnAtRemainingSec / 2);
const warnNow = addSec(started, warnElapsed);
const tickWarn = tickSession(grantedSec, caps, started, warnNow, warnNow);
check(
  "remaining <= warnAtRemainingSec (but > 0, not idle) → warn",
  tickWarn.action === "warn" &&
    tickWarn.remainingSec > 0 &&
    tickWarn.remainingSec <= caps.warnAtRemainingSec,
);

// --- Summary -----------------------------------------------------------------

console.log(`\nguard ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
