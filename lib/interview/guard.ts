/**
 * Cost-cap / session-guard BRAIN (Phase 8, plan §5, Hardening §E).
 * Pure - no LLM, no DB, no network, no wall-clock reads. Live voice is the one
 * variable cost in the whole system (a 30-min ElevenLabs mock ≈ $2.40–4.80 +
 * tokens), so this module is the kill-switch that stops it running up a bill.
 * The caller injects every instant as an ISO-8601 string; all time math runs off
 * `Date.parse` + millisecond offsets, so the guard is fully deterministic and
 * unit-testable with no DB / network / system clock.
 *
 * Safety spine:
 *   - HARD PER-SESSION CEILING: a session is granted at most maxSessionSec, and
 *     `tickSession` hangs it up the instant the granted budget is spent.
 *   - DAILY KILL-SWITCH: once the local day's secondsUsed reaches dailyCapSec,
 *     no new session may start, regardless of the per-session ceiling.
 *   - IDLE AUTO-HANGUP: a session with no candidate activity for idleHangupSec
 *     is ended, so a forgotten open tab can't burn the budget.
 *   - CLOCK-INJECTED: time arrives as ISO strings; the guard never reads the
 *     system clock, so the same inputs always yield the same decision.
 */
import type {
  DailyUsage,
  SessionTick,
  StartDecision,
  VoiceCaps,
} from "@/lib/interview/types";

/**
 * The UTC calendar day "YYYY-MM-DD" of an instant. Derived purely from the
 * injected ISO string (parse → re-serialize → take the date head); never reads
 * the system clock. Used to bucket DailyUsage for the kill-switch.
 */
export function dayKey(iso: string): string {
  return new Date(Date.parse(iso)).toISOString().slice(0, 10);
}

/**
 * Decide whether a live session may start, and for how long.
 *   - dailyRemainingSec = max(0, dailyCapSec - secondsUsed).
 *   - none left → blocked (the daily kill-switch has tripped).
 *   - otherwise grant min(maxSessionSec, dailyRemainingSec) - the per-session
 *     ceiling, clamped down to whatever budget the day has left.
 */
export function decideStart(
  caps: VoiceCaps,
  usage: DailyUsage,
): StartDecision {
  const dailyRemainingSec = Math.max(0, caps.dailyCapSec - usage.secondsUsed);

  if (dailyRemainingSec <= 0) {
    return {
      allowed: false,
      reason: "Daily voice limit reached - try again tomorrow.",
      grantedSec: 0,
      dailyRemainingSec: 0,
    };
  }

  const grantedSec = Math.min(caps.maxSessionSec, dailyRemainingSec);
  const grantedMin = Math.round(grantedSec / 60);
  return {
    allowed: true,
    reason: `Session approved for up to ${grantedMin} min (${grantedSec}s).`,
    grantedSec,
    dailyRemainingSec,
  };
}

/**
 * What the live session should do right now, given the granted budget and the
 * injected instants. Decisions are made in strict priority order so the harder
 * stop always wins:
 *   1. budget spent (remainingSec <= 0)        → "hangup"
 *   2. idle too long (idleSec >= idleHangup)    → "idle_hangup"
 *   3. budget almost gone (remaining <= warnAt) → "warn"
 *   4. otherwise                                → "continue"
 */
export function tickSession(
  grantedSec: number,
  caps: VoiceCaps,
  startedAtIso: string,
  lastActivityIso: string,
  nowIso: string,
): SessionTick {
  const nowMs = Date.parse(nowIso);
  const elapsedSec = Math.floor((nowMs - Date.parse(startedAtIso)) / 1000);
  const idleSec = Math.floor((nowMs - Date.parse(lastActivityIso)) / 1000);
  const remainingSec = Math.max(0, grantedSec - elapsedSec);

  if (remainingSec <= 0) {
    return {
      action: "hangup",
      elapsedSec,
      remainingSec: 0,
      reason: "Session time limit reached - wrapping up.",
    };
  }

  if (idleSec >= caps.idleHangupSec) {
    return {
      action: "idle_hangup",
      elapsedSec,
      remainingSec,
      reason: `No activity for ${idleSec}s - ending the session.`,
    };
  }

  if (remainingSec <= caps.warnAtRemainingSec) {
    return {
      action: "warn",
      elapsedSec,
      remainingSec,
      reason: `About ${remainingSec}s left in this session.`,
    };
  }

  return {
    action: "continue",
    elapsedSec,
    remainingSec,
    reason: `Session in progress - ${remainingSec}s remaining.`,
  };
}
