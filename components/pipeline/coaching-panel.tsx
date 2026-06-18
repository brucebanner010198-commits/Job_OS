"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, Send, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VoiceInput } from "@/components/dictation/voice-input";
import { Badge } from "@/components/ui/badge";
import {
  startCoachingAction,
  coachingTurnAction,
} from "@/app/actions/onboarding";
import {
  sectionLabel,
  sectionStatusColor,
} from "@/lib/onboarding/coaching-display";
import type {
  CoachingCoverage,
  CoachingTurn,
  OnboardingPath,
} from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

export function CoachingPanel({
  path,
  initialPaste,
  onComplete,
  onSkip,
  showSkip = false,
}: {
  path: OnboardingPath;
  initialPaste?: string;
  onComplete: (turns: CoachingTurn[]) => void;
  onSkip?: () => void;
  showSkip?: boolean;
}) {
  const [turns, setTurns] = useState<CoachingTurn[]>([]);
  const [input, setInput] = useState("");
  const [coverage, setCoverage] = useState<CoachingCoverage | null>(null);
  const [finalGapCheck, setFinalGapCheck] = useState(false);
  const [remainingGaps, setRemainingGaps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [skipWarningOpen, setSkipWarningOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await startCoachingAction({
          path,
          initialPaste,
        });
        if (cancelled) return;
        setTurns([{ role: "assistant", content: result.assistantMessage }]);
        setCoverage(result.coverage);
        setFinalGapCheck(result.finalGapCheck);
        setRemainingGaps(result.remainingGaps);
        if (result.shouldStop) {
          onComplete([{ role: "assistant", content: result.assistantMessage }]);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to start coaching.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function send() {
    const msg = input.trim();
    if (!msg || pending) return;
    setError(null);
    setInput("");

    const userTurn: CoachingTurn = { role: "user", content: msg };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);

    startTransition(async () => {
      try {
        const result = await coachingTurnAction({
          path,
          turns: nextTurns.slice(0, -1),
          userMessage: msg,
          initialPaste,
        });
        const assistantTurn: CoachingTurn = {
          role: "assistant",
          content: result.assistantMessage,
        };
        const fullTurns = [...nextTurns, assistantTurn];
        setTurns(fullTurns);
        setCoverage(result.coverage);
        setFinalGapCheck(result.finalGapCheck);
        setRemainingGaps(result.remainingGaps);

        if (result.shouldStop) {
          onComplete(fullTurns);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setTurns(turns);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Starting career coaching session…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {coverage && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(coverage.sections) as (keyof typeof coverage.sections)[]).map(
            (key) => (
              <Badge key={key} variant="muted" className="text-xs">
                <span className={cn("mr-1", sectionStatusColor(coverage.sections[key]))}>
                  ●
                </span>
                {sectionLabel(key)}
              </Badge>
            ),
          )}
        </div>
      )}

      {finalGapCheck && remainingGaps.length > 0 && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 p-3 text-sm">
          <p className="font-medium">Before we wrap up — any of these to add?</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {remainingGaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        ref={scrollRef}
        className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-4"
      >
        {turns.map((t, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-lg px-3 py-2 text-sm",
              t.role === "assistant"
                ? "bg-muted/60 text-foreground"
                : "ml-auto bg-accent/10 text-foreground",
            )}
          >
            {t.content}
          </div>
        ))}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking…
          </div>
        )}
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      <div className="flex gap-2">
        <div className="flex-1">
          <VoiceInput
            value={input}
            onChange={setInput}
            placeholder="Type or speak your answer…"
            rows={3}
          />
        </div>
        <Button
          variant="accent"
          size="icon"
          className="h-auto shrink-0 self-end"
          onClick={send}
          disabled={pending || !input.trim()}
          aria-label="Send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {skipWarningOpen && (
        <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/5 p-4 text-sm">
          <p className="font-medium">Skip career coaching?</p>
          <p className="mt-1 text-muted-foreground">
            Goals and profile gaps may stay incomplete. Your resume entries will be kept,
            but we recommend completing coaching when you can.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setSkipWarningOpen(false)}>
              Continue coaching
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSkip?.()}
              className="border-[var(--warning)]/40"
            >
              Skip anyway
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
        {showSkip && onSkip && !skipWarningOpen && (
          <Button
            variant="outline"
            onClick={() => setSkipWarningOpen(true)}
            className="gap-2"
          >
            <SkipForward className="h-4 w-4" />
            Skip coaching
          </Button>
        )}
        {coverage?.sufficient && (
          <Button
            variant="outline"
            onClick={() => onComplete(turns)}
            className="ml-auto"
          >
            I&apos;m done — compile profile
          </Button>
        )}
      </div>
    </div>
  );
}
