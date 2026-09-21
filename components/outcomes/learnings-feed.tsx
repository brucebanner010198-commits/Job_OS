/**
 * Outcome learnings feed: surfaces rejection insights from the learning loop.
 */
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Lightbulb, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RejectionLearningView } from "@/lib/track/learnings-view";

const KIND_LABEL: Record<string, string> = {
  resume: "Resume",
  cover_letter: "Cover letter",
  apply_answer: "Apply answers",
  targeting: "Targeting",
};

function LearningCard({ item }: { item: RejectionLearningView }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">{item.company}</span>
        <span className="text-xs text-muted-foreground">{item.role}</span>
        <Badge
          variant={item.category === "SOFT_REJECTION" ? "muted" : "danger"}
          className="text-[10px]"
        >
          {item.category === "SOFT_REJECTION" ? "Soft rejection" : "Rejection"}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          {item.primaryCategory}
        </Badge>
      </div>

      <p className="mt-2 text-sm text-muted-foreground">{item.summary}</p>

      {item.suggestions.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {item.suggestions.slice(0, 3).map((s) => (
            <li key={s.text} className="flex items-start gap-2 text-xs text-foreground/90">
              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-accent" />
              <span>
                <span className="font-medium text-muted-foreground">
                  {KIND_LABEL[s.kind] ?? s.kind}:
                </span>{" "}
                {s.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2.5">
        <p className="text-[10px] text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {item.signals.length > 0 && ` · signals: ${item.signals.slice(0, 2).join(", ")}`}
        </p>

        <ReplyDrawer company={item.company} role={item.role} />
      </div>
    </div>
  );
}

function ReplyDrawer({ company, role }: { company: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentNotice, setSentNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    if (!draft) {
      startTransition(async () => {
        const { generateRejectionReplyAction } = await import("@/app/actions/rejection-reply");
        const res = await generateRejectionReplyAction({ company, jobTitle: role });
        setDraft(res);
      });
    }
  }

  async function handleCopy() {
    if (!draft) return;
    await navigator.clipboard.writeText(draft.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleSend() {
    if (!draft) return;
    startTransition(async () => {
      const { sendRejectionReplyAction } = await import("@/app/actions/rejection-reply");
      const res = await sendRejectionReplyAction({
        toEmail: `${company.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
        subject: draft.subject,
        body: draft.body,
      });
      setSentNotice(res.message);
    });
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleOpen}
        className="h-6 text-[11px] text-primary hover:text-primary/90"
      >
        Send polite reply →
      </Button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 text-xs">
      <div className="flex items-center justify-between font-medium text-foreground">
        <span>Polite Rejection Acknowledgment:</span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={handleCopy} className="h-6 text-[10px]">
            {copied ? "Copied" : "Copy text"}
          </Button>
          <Button size="sm" onClick={handleSend} disabled={pending} className="h-6 text-[10px]">
            {pending ? "Sending..." : "Send reply"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-6 text-[10px]">
            Close
          </Button>
        </div>
      </div>
      {sentNotice ? (
        <p className="text-emerald-500 font-medium">{sentNotice}</p>
      ) : draft ? (
        <pre className="whitespace-pre-wrap rounded bg-background p-2 font-mono text-[11px] text-muted-foreground border border-border">
          {draft.body}
        </pre>
      ) : (
        <p className="text-muted-foreground">Drafting personalized polite reply...</p>
      )}
    </div>
  );
}

export function LearningsFeed({
  items,
  preview = false,
}: {
  items: RejectionLearningView[];
  preview?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Lightbulb className="h-4 w-4 text-accent" />
            Rejection learnings
          </CardTitle>
          {preview && (
            <Badge variant="muted" className="text-[10px]">
              sample preview
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Actionable fixes captured when you confirm rejections on the tracker.
          Advisory only: nothing auto-changes your profile.
        </p>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No learnings yet. Confirm a rejection on{" "}
            <Link href="/track" className="text-accent hover:underline">
              Tracker
            </Link>{" "}
            to capture insights here.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <LearningCard key={item.id} item={item} />
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          <Link
            href="/training"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            Training hub
            <ArrowRight className="h-3 w-3" />
          </Link>{" "}
          for gap analysis and resume standards.
        </p>
      </CardContent>
    </Card>
  );
}
