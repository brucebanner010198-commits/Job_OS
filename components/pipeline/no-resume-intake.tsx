"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquare, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { VoiceInput } from "@/components/dictation/voice-input";
import { extractInitialPasteAction } from "@/app/actions/onboarding";
import { cn } from "@/lib/utils";

type IntakeMode = "paste" | "conversation";

export function NoResumeIntake({
  initialPaste,
  onPasteChange,
  onContinue,
}: {
  initialPaste: string;
  onPasteChange: (text: string) => void;
  onContinue: (mode: IntakeMode) => void;
}) {
  const [mode, setMode] = useState<IntakeMode | null>(
    initialPaste.trim() ? "paste" : null,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [entryCount, setEntryCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function analyzePaste() {
    setError(null);
    startTransition(async () => {
      try {
        const r = await extractInitialPasteAction(initialPaste);
        setEntryCount(r.entryCount);
        setPreview(r.preview);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("paste")}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
            mode === "paste"
              ? "border-accent bg-accent/5 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/30",
          )}
        >
          <ClipboardPaste className="h-4 w-4" />
          Paste what you know
        </button>
        <button
          type="button"
          onClick={() => setMode("conversation")}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
            mode === "conversation"
              ? "border-accent bg-accent/5 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted/30",
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Start conversation
        </button>
      </div>

      {mode === "paste" && (
        <div className="space-y-3">
          <VoiceInput
            value={initialPaste}
            onChange={onPasteChange}
            placeholder="Paste LinkedIn About, job history, education, skills — anything you have…"
            rows={10}
          />
          {initialPaste.trim().length > 0 && !preview && (
            <Button variant="outline" size="sm" onClick={analyzePaste} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" /> Analyzing…
                </>
              ) : (
                "Preview extracted topics"
              )}
            </Button>
          )}
          {preview && (
            <p className="text-sm text-muted-foreground">
              Found ~{entryCount} topics: {preview}
            </p>
          )}
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <div className="flex justify-end">
            <Button
              variant="accent"
              onClick={() => onContinue("paste")}
              disabled={initialPaste.trim().length === 0}
            >
              Continue to coaching
            </Button>
          </div>
        </div>
      )}

      {mode === "conversation" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No problem — the career coach will walk you through your history step by step.
            You can also add a quick note below if you want to give a head start.
          </p>
          <VoiceInput
            value={initialPaste}
            onChange={onPasteChange}
            placeholder="Optional: jot a few sentences about your current role or goals…"
            rows={4}
          />
          <div className="flex justify-end">
            <Button variant="accent" onClick={() => onContinue("conversation")}>
              Start coaching session
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
