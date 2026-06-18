"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, ShieldAlert } from "lucide-react";
import { VoiceInput } from "@/components/dictation/voice-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  saveDictationAction,
  type SaveDictationResult,
} from "@/app/actions/profile";

export function DictationPanel() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SaveDictationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await saveDictationAction(text);
        setResult(r);
        setText("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-medium">What have you been working on?</h2>
      <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
        Speak or type an update - a new project, a job change, a skill, a win.
        The AI organizes it into your master profile. Nothing is invented.
      </p>

      <VoiceInput
        value={text}
        onChange={setText}
        rows={5}
        placeholder="e.g. This month I led the migration of our billing service to Postgres, cutting p95 latency by 40%…"
      />

      <div className="mt-3 flex items-center gap-3">
        <Button onClick={save} disabled={pending || text.trim().length === 0}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" /> Organizing…
            </>
          ) : (
            "Add to master resume"
          )}
        </Button>
        <span className="text-xs text-muted-foreground">
          Tip: use Wispr Flow&apos;s hotkey for the cleanest dictation.
        </span>
      </div>

      {error && (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-[var(--success)]" />
            Added {result.added} {result.added === 1 ? "entry" : "entries"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.entries.map((e, i) => (
              <Badge key={i} variant={e.sensitive ? "warning" : "muted"}>
                {e.sensitive && <ShieldAlert className="mr-1 h-3 w-3" />}
                {e.title}
              </Badge>
            ))}
          </div>
          {result.entries.some((e) => e.sensitive) && (
            <p className="mt-2 text-xs text-muted-foreground">
              Items marked sensitive are kept private and withheld from AI
              generation.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
