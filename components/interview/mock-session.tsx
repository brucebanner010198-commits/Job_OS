/**
 * Mock session surface (Phase 8, plan §5, Hardening §A/§E) - the live-session UI
 * for ONE chosen live mode (AI_SCREEN or REAL_HR; the mode picker lives on the
 * parent card). It demonstrates the entire flow - mic pre-flight → start → cost
 * meter → turn-by-turn transcript → score - with no ElevenLabs key and zero spend.
 *
 * Safety spine encoded here:
 *   - COST IS CAPPED + SERVER-DECIDED: a session only ever starts via
 *     startSessionAction, which runs the guard (per-session limit ∧ daily
 *     kill-switch). If decision.allowed is false we show the block reason and
 *     stop. The on-screen COST METER counts down the SERVER-granted budget; a
 *     turn that would run past it auto-stops (the authoritative idle/limit hangup
 *     is enforced server-side by the guard).
 *   - KEY STAYS SERVER-SIDE: the browser only ever receives a VoiceGrant (a
 *     short-lived signed URL or, with no key, an empty URL + a scripted mock). A
 *     real signedUrl is a documented SEAM for the @elevenlabs/react SDK - we
 *     surface it but DO NOT add the dependency, and still allow the mock fallback.
 *   - SENSITIVE NEVER LEAVES: this client never imports the profile fixtures (they
 *     carry the sensitive fact). The offline preview plays a generic, prep-derived
 *     demo script, and the local score is computed with facts:[] - extractive-safe.
 *   - PROPOSE, DON'T AUTO-START: nothing starts itself; the human clicks Start.
 */
"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  Loader2,
  Mic,
  MicOff,
  Play,
  Radio,
  RotateCcw,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ScoreCard } from "@/components/interview/score-card";
import { scoreSession } from "@/lib/interview/score";
import {
  abortSessionAction,
  finishSessionAction,
  startSessionAction,
} from "@/app/actions/interview";
import type {
  InterviewMode,
  SessionScore,
  TranscriptTurn,
  VoiceCaps,
} from "@/lib/interview/types";

interface MockSessionProps {
  company: string;
  role?: string;
  applicationId?: string;
  /** The chosen LIVE mode - AI_SCREEN or REAL_HR (the parent owns the picker). */
  mode: InterviewMode;
  /** Sample-preview mode: Start is disabled (no DB) but the mock still previews. */
  readOnly: boolean;
  caps: VoiceCaps;
  dailyRemainingSec: number;
}

type Phase = "idle" | "blocked" | "liveReady" | "playing" | "done";
type MicState = "unknown" | "ready" | "unavailable";

/** Reveal the next scripted turn every this-many ms (a brisk demo, not realtime). */
const REVEAL_MS = 1400;

const MODE_LABEL: Record<InterviewMode, string> = {
  STUDY: "Study",
  AI_SCREEN: "AI screen",
  REAL_HR: "Real-HR manager",
};

const READONLY_TIP = "connect a database to run a real session";

/** mm:ss for the cost meter. */
function fmtClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * A generic, prep-derived demo conversation for the offline preview. It is NOT a
 * real answer and invents no user-specific metric - it only references the
 * company/role from props (non-sensitive board data) and is clearly labelled a
 * sample, so the flow is demonstrable without importing the profile fixtures.
 */
function demoScript(company: string, role?: string): TranscriptTurn[] {
  const r = role && role.trim() ? role.trim() : "this role";
  return [
    {
      role: "interviewer",
      text: "Thanks for joining. To start, tell me about a project you're proud of.",
      atSec: 0,
    },
    {
      role: "candidate",
      text: "The situation was a service struggling under heavy load. My task was to make it reliable. I led a redesign and introduced safeguards, then staged the rollout carefully. As a result the system stabilised and incidents dropped noticeably.",
      atSec: 9,
    },
    {
      role: "interviewer",
      text: "What trade-off did you weigh there?",
      atSec: 55,
    },
    {
      role: "candidate",
      text: `I chose stronger delivery guarantees over raw speed. It cost a little latency but removed a whole class of failures, which matters more for a team like ${company}.`,
      atSec: 63,
    },
    {
      role: "interviewer",
      text: `Last one - why ${r}?`,
      atSec: 105,
    },
    {
      role: "candidate",
      text: `I want to work where reliability is the product, and that is exactly what ${r} at ${company} is about.`,
      atSec: 113,
    },
    {
      role: "interviewer",
      text: "Great - that's all from me. We'll be in touch about next steps.",
      atSec: 140,
    },
  ];
}

export function MockSession({
  company,
  role,
  applicationId,
  mode,
  readOnly,
  caps,
  dailyRemainingSec,
}: MockSessionProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [mic, setMic] = useState<MicState>("unknown");
  const [note, setNote] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [grantedSec, setGrantedSec] = useState(0);
  const [simElapsed, setSimElapsed] = useState(0);
  const [score, setScore] = useState<SessionScore | null>(null);
  const [interviewer, setInterviewer] = useState("");
  const [saving, setSaving] = useState(false);
  const [pending, startTransition] = useTransition();

  // Refs hold the live playback bookkeeping so the interval never reads stale
  // state (the timer body runs outside React's render cycle).
  const idxRef = useRef(0);
  const scriptRef = useRef<TranscriptTurn[]>([]);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const grantedRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const pendingMockRef = useRef<TranscriptTurn[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Always release the timer on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  /** Probe the mic before starting; failure never blocks (text/mock fallback). */
  const preflightMic = useCallback(async (): Promise<void> => {
    // Never crash if mediaDevices is undefined (insecure context / SSR).
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function"
    ) {
      setMic("unavailable");
      setNote("No microphone available - running in text/mock mode.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the device immediately - the mock needs no live capture.
      stream.getTracks().forEach((t) => t.stop());
      setMic("ready");
    } catch {
      setMic("unavailable");
      setNote("No mic - running in text/mock mode.");
    }
  }, []);

  /** Stop playback, compute a deterministic local score, persist best-effort. */
  const finishPlayback = useCallback(
    async (limited: boolean) => {
      clearTimer();
      const turns = transcriptRef.current;
      const elapsed = limited
        ? grantedRef.current
        : turns.length > 0
          ? turns[turns.length - 1].atSec
          : 0;
      // Score CLIENT-SIDE with the pure, deterministic scorer. facts:[] keeps it
      // extractive-safe (no sensitive data client-side); the server scores the
      // same input identically, so the displayed score is authoritative.
      const computed = scoreSession(turns, mode, { company, role, facts: [] });
      setScore(computed);
      setSimElapsed(elapsed);
      setPhase("done");

      const sid = sessionIdRef.current;
      if (sid) {
        setSaving(true);
        try {
          await finishSessionAction(sid, turns, elapsed, mode);
        } catch {
          // Persistence is best-effort - the score still shows from the compute.
        } finally {
          setSaving(false);
        }
      }
    },
    [clearTimer, mode, company, role],
  );

  /** Drive the scripted reveal on a timer into the live transcript view. */
  const beginPlayback = useCallback(
    (script: TranscriptTurn[], granted: number, sid: string | null) => {
      clearTimer();
      idxRef.current = 0;
      transcriptRef.current = [];
      scriptRef.current = script;
      grantedRef.current = granted;
      sessionIdRef.current = sid;
      setTranscript([]);
      setGrantedSec(granted);
      setSimElapsed(0);
      setScore(null);
      setPhase("playing");

      intervalRef.current = setInterval(() => {
        const i = idxRef.current;
        const turns = scriptRef.current;
        if (i >= turns.length) {
          void finishPlayback(false);
          return;
        }
        const next = turns[i];
        // LIMIT auto-stop: never reveal a turn past the granted budget.
        if (next.atSec > grantedRef.current) {
          void finishPlayback(true);
          return;
        }
        transcriptRef.current = [...transcriptRef.current, next];
        idxRef.current = i + 1;
        setTranscript(transcriptRef.current);
        setSimElapsed(next.atSec);
      }, REVEAL_MS);
    },
    [clearTimer, finishPlayback],
  );

  /** Start a real (server-guarded) session. Disabled in sample-preview mode. */
  function onStart() {
    if (readOnly) return;
    setNote("");
    setBlockReason("");
    setInterviewer("");
    startTransition(async () => {
      // Pre-flight the mic; a failure does not block - we fall back to text/mock.
      await preflightMic();
      try {
        // Positional args + null (not undefined) per the action contract.
        const res = await startSessionAction(
          company,
          applicationId ?? null,
          role ?? null,
          mode,
        );

        if (!res.ok || !res.decision) {
          setBlockReason("Could not start a session - try the sample preview.");
          setPhase("blocked");
          return;
        }
        if (!res.decision.allowed) {
          // Daily kill-switch (or another guard reason) blocked the start.
          setBlockReason(
            res.decision.reason || "Daily voice limit reached for today.",
          );
          setPhase("blocked");
          return;
        }
        // Allowed, but the service must also have minted a grant + session.
        if (!res.grant || !res.sessionId) {
          setBlockReason("Could not start a session - try the sample preview.");
          setPhase("blocked");
          return;
        }

        const granted = res.decision.grantedSec;
        const grant = res.grant;
        const sessionId = res.sessionId;
        setInterviewer(res.persona?.name ?? MODE_LABEL[mode]);
        const mockTurns = grant.mock?.turns ?? demoScript(company, role);

        // Live SEAM: a real signed URL means the @elevenlabs/react SDK would
        // connect here. We surface that and still let the user run the mock.
        if (grant.provider !== "fixture" && grant.signedUrl !== "") {
          sessionIdRef.current = sessionId;
          pendingMockRef.current = mockTurns;
          setGrantedSec(granted);
          setNote(
            "Live voice ready (connect the @elevenlabs/react SDK here). You can also run the scripted mock below.",
          );
          setPhase("liveReady");
          return;
        }

        // Fixture / no key configured → play the scripted mock now, zero cost.
        beginPlayback(mockTurns, granted, sessionId);
      } catch {
        setBlockReason("Could not start a session - try the sample preview.");
        setPhase("blocked");
      }
    });
  }

  /** Preview the scripted mock with no server round-trip (always available). */
  function onPreview() {
    setBlockReason("");
    setInterviewer(MODE_LABEL[mode]);
    setNote(
      "Sample preview, a scripted mock of the live session. Connect a database to run a real, cost-limited session.",
    );
    const granted =
      dailyRemainingSec > 0
        ? Math.min(caps.maxSessionSec, dailyRemainingSec)
        : caps.maxSessionSec;
    beginPlayback(demoScript(company, role), granted, null);
  }

  /** Play the mock from the live-ready seam state. */
  function onPlayMock() {
    beginPlayback(pendingMockRef.current, grantedSec, sessionIdRef.current);
  }

  /** Reset everything back to the start, aborting any open session. */
  function reset(abort: boolean) {
    clearTimer();
    const sid = sessionIdRef.current;
    idxRef.current = 0;
    transcriptRef.current = [];
    scriptRef.current = [];
    pendingMockRef.current = [];
    sessionIdRef.current = null;
    setTranscript([]);
    setScore(null);
    setSimElapsed(0);
    setGrantedSec(0);
    setBlockReason("");
    setNote("");
    setInterviewer("");
    setPhase("idle");
    if (abort && sid) {
      void abortSessionAction(sid).catch(() => {
        // Best-effort abort - the timer is already stopped client-side.
      });
    }
  }

  // -- Derived cost-meter values ----------------------------------------------
  const remaining = Math.max(0, grantedSec - simElapsed);
  const dailyLeftMin = Math.max(
    0,
    Math.floor((dailyRemainingSec - simElapsed) / 60),
  );
  const warn = grantedSec > 0 && remaining <= caps.warnAtRemainingSec;

  return (
    <div className="space-y-4">
      {/* Header - mode + mic status. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {MODE_LABEL[mode]}
          </Badge>
          {mic === "ready" && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--success)]">
              <Mic className="h-3.5 w-3.5" /> mic ready
            </span>
          )}
          {mic === "unavailable" && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MicOff className="h-3.5 w-3.5" /> text/mock mode
            </span>
          )}
        </div>
      </div>

      {/* Notices. */}
      {note && (
        <p className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
          {note}
        </p>
      )}
      {phase === "blocked" && (
        <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-foreground">
          {blockReason}
        </p>
      )}

      {/* Idle - the two entry points. */}
      {phase === "idle" && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="accent"
            disabled={readOnly || pending}
            title={readOnly ? READONLY_TIP : undefined}
            onClick={onStart}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Start session
          </Button>
          <Button variant="outline" onClick={onPreview}>
            Preview mock
          </Button>
        </div>
      )}

      {/* Blocked - let the user still preview the mock. */}
      {phase === "blocked" && (
        <Button variant="outline" onClick={onPreview}>
          Preview mock instead
        </Button>
      )}

      {/* Live seam - real signed URL present; offer the mock fallback. */}
      {phase === "liveReady" && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Radio className="h-4 w-4 text-accent" /> Live voice ready
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Connect the @elevenlabs/react SDK at this seam to run real voice. The
            scripted mock below works right now with no extra dependency.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="accent" onClick={onPlayMock}>
              <Play className="h-4 w-4" /> Play scripted mock
            </Button>
            <Button variant="outline" onClick={() => reset(true)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Playing - cost meter + live transcript. */}
      {phase === "playing" && (
        <div className="space-y-3">
          <div
            className={cn(
              "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs",
              warn
                ? "border-[var(--warning)]/40 bg-[var(--warning)]/10"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="font-medium uppercase tracking-wide text-muted-foreground">
                Session
              </span>
              <span
                className={cn(
                  "tabular-nums font-semibold",
                  warn ? "text-[var(--warning)]" : "text-foreground",
                )}
              >
                {fmtClock(remaining)} left
              </span>
              <span className="text-muted-foreground">
                of {fmtClock(grantedSec)}
              </span>
            </div>
            <span className="text-muted-foreground">
              {dailyLeftMin} min left today
            </span>
          </div>

          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            {transcript.length === 0 ? (
              <p className="text-xs text-muted-foreground">Connecting…</p>
            ) : (
              transcript.map((t, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col gap-0.5",
                    t.role === "candidate" && "items-end",
                  )}
                >
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t.role === "candidate"
                      ? "You"
                      : interviewer || "Interviewer"}
                  </span>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      t.role === "candidate"
                        ? "bg-accent/10 text-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {t.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="accent" onClick={() => void finishPlayback(false)}>
              <Square className="h-4 w-4" /> End &amp; score
            </Button>
            <Button variant="outline" onClick={() => reset(true)}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Done - the score. */}
      {phase === "done" && score && (
        <div className="space-y-3">
          {saving && (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving session…
            </p>
          )}
          <ScoreCard score={score} />
          <Button variant="outline" onClick={() => reset(false)}>
            <RotateCcw className="h-4 w-4" /> Run again
          </Button>
        </div>
      )}
    </div>
  );
}
