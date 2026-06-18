/**
 * Study guide (Phase 8, plan §5) - the always-free, fully-offline core of prep.
 * Presentational: it renders the StudyGuide the extractive study brain produced -
 * the top-5 likely questions, each with its STAR model answer assembled ONLY from
 * the user's real profile facts, a category, and a delivery tip.
 *
 * Safety role:
 *   - PROVENANCE VISIBLE: a "grounded" badge when every answer traces to a real
 *     fact; a calm "fill in your examples" badge when it couldn't be grounded
 *     (provenanceOk === false) so nothing is ever passed off as invented truth.
 *   - SENSITIVE STAYS PRIVATE: the brain already withheld sensitive facts; when
 *     any were withheld we show a short reassurance note. We NEVER render a raw
 *     fact id (usedFactIds is provenance metadata, not display text).
 */
"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { QAItem, QuestionCategory, StudyGuide as StudyGuideModel } from "@/lib/interview/types";

type BadgeVariant =
  | "muted"
  | "default"
  | "outline"
  | "warning"
  | "success"
  | "danger"
  | "accent";

const CATEGORY_LABEL: Record<QuestionCategory, string> = {
  BEHAVIORAL: "Behavioral",
  ROLE_SPECIFIC: "Role-specific",
  COMPANY_FIT: "Company fit",
  MOTIVATION: "Motivation",
  SITUATIONAL: "Situational",
};

const CATEGORY_VARIANT: Record<QuestionCategory, BadgeVariant> = {
  BEHAVIORAL: "accent",
  ROLE_SPECIFIC: "default",
  COMPANY_FIT: "success",
  MOTIVATION: "warning",
  SITUATIONAL: "outline",
};

const STAR_PARTS = [
  { key: "situation", label: "Situation" },
  { key: "task", label: "Task" },
  { key: "action", label: "Action" },
  { key: "result", label: "Result" },
] as const;

// --- Copy-to-clipboard button -----------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) - silently no-op.
    }
  }
  return (
    <Button size="sm" variant="ghost" onClick={copy} className="h-7 px-2">
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" /> Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </Button>
  );
}

// --- One question (native accordion, zero deps) ------------------------------

function QACard({ item, index }: { item: QAItem; index: number }) {
  return (
    <details className="group rounded-xl border border-border bg-card open:bg-card">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {index + 1}.
            </span>
            <span className="text-sm font-medium text-foreground">
              {item.question}
            </span>
          </div>
          <div className="mt-2 pl-6">
            <Badge
              variant={CATEGORY_VARIANT[item.category]}
              className="text-[10px]"
            >
              {CATEGORY_LABEL[item.category]}
            </Badge>
          </div>
        </div>
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-border p-4">
        {/* The STAR model answer. */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Model answer
            </span>
            <CopyButton text={item.modelAnswer} />
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {item.modelAnswer}
          </p>
        </div>

        {/* STAR breakdown, when the brain supplied the parts. */}
        {item.starParts && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {STAR_PARTS.map((p) => (
              <div
                key={p.key}
                className="rounded-lg border border-border bg-background p-3"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wide text-accent">
                  {p.label}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {item.starParts![p.key]}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Delivery tip. */}
        {item.tip && (
          <p className="rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Tip: </span>
            {item.tip}
          </p>
        )}
      </div>
    </details>
  );
}

// --- The guide ---------------------------------------------------------------

export function StudyGuide({ guide }: { guide: StudyGuideModel }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {guide.provenanceOk ? (
          <Badge variant="success" className="text-[10px]">
            grounded in your profile
          </Badge>
        ) : (
          <Badge variant="warning" className="text-[10px]">
            fill in your examples
          </Badge>
        )}
        {!guide.provenanceOk && (
          <span className="text-xs text-muted-foreground">
            Add real experience to your profile and these answers ground
            themselves - nothing here is invented.
          </span>
        )}
      </div>

      {/* Reassurance: sensitive facts were withheld, never used. */}
      {guide.withheldSensitive > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {guide.withheldSensitive} sensitive{" "}
            {guide.withheldSensitive === 1 ? "fact was" : "facts were"} kept
            private - never used in any answer, prompt, or session.
          </span>
        </p>
      )}

      <div className="space-y-2">
        {guide.questions.map((q, i) => (
          <QACard key={i} item={q} index={i} />
        ))}
      </div>
    </div>
  );
}
