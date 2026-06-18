"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { importResumeAction, type ImportResult } from "@/app/actions/profile";

export function ImportForm(props: {
  embedded?: boolean;
  onImported?: () => void;
}) {
  const { embedded = false, onImported } = props;
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await importResumeAction(text);
        setResult(r);
        if (r.added > 0) {
          setText("");
          router.refresh();
          onImported?.();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder="Paste your existing resume text (or LinkedIn 'About' + Experience) here…"
        className="font-mono text-xs"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={run} disabled={pending || text.trim().length === 0}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" /> Importing…
            </>
          ) : (
            "Import into master resume"
          )}
        </Button>
        {!embedded && (
          <Link href="/master-resume" className="text-sm text-accent hover:underline">
            View master resume →
          </Link>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>}

      {result && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-[var(--success)]" />
            Imported {result.added} {result.added === 1 ? "entry" : "entries"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.kinds.map((k, i) => (
              <Badge key={i} variant="muted">
                {k}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
