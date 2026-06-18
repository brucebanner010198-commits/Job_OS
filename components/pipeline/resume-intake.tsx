"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Upload, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  importResumeAction,
  uploadResumeFileAction,
  type ImportResult,
} from "@/app/actions/profile";
import { cn } from "@/lib/utils";

const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function ResumeIntake({
  embedded = false,
  onImported,
}: {
  embedded?: boolean;
  onImported?: () => void;
}) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const showResult = useCallback(
    (r: ImportResult) => {
      setResult(r);
      if (r.added > 0) {
        setText("");
        router.refresh();
        onImported?.();
      }
    },
    [onImported, router],
  );

  function runPasteImport() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const r = await importResumeAction(text);
        showResult(r);
        if (r.added === 0 && text.trim()) {
          setError("No entries could be extracted. Check the text and try again.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function runFileImport(file: File) {
    setError(null);
    setResult(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("file", file);
        const r = await uploadResumeFileAction(formData);
        showResult(r);
        if (r.added === 0) {
          setError("No entries could be extracted from this file. Try paste instead.");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not read this file.");
      }
    });
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) runFileImport(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) runFileImport(file);
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rounded-xl border border-dashed p-6 text-center transition-colors",
          dragOver ? "border-accent bg-accent/5" : "border-border bg-muted/20",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onFileChange}
          disabled={pending}
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Upload your resume</p>
        <p className="mt-1 text-xs text-muted-foreground">PDF or Word (.docx), up to 5 MB</p>
        <Button
          type="button"
          variant="accent"
          className="mt-4 gap-2"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
        >
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing…
            </>
          ) : (
            <>
              <FileText className="h-4 w-4" />
              Choose file
            </>
          )}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Scanned PDFs are not supported — use a text-based export or paste below.
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">or paste below</span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={embedded ? 10 : 14}
          placeholder="Paste your existing resume text (or LinkedIn export) here…"
          className="font-mono text-xs"
          disabled={pending}
        />
        <div className="mt-3 flex items-center gap-3">
          <Button onClick={runPasteImport} disabled={pending || text.trim().length === 0}>
            {pending ? (
              <>
                <Loader2 className="animate-spin" /> Importing…
              </>
            ) : (
              "Import from paste"
            )}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

      {result && result.added > 0 && (
        <div className="rounded-lg border border-border bg-background p-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Check className="h-4 w-4 text-[var(--success)]" />
            Imported {result.added} {result.added === 1 ? "entry" : "entries"}
            {result.format && result.format !== "paste" && (
              <span className="text-muted-foreground">from {result.format.toUpperCase()}</span>
            )}
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
