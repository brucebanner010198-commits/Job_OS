/**
 * Follow-up list (Phase 7 booster, plan §10). Renders the cadence's drafted
 * nudges as cards - company/role, a kind badge, an urgency badge (overdue is the
 * strongest), the due date, and the drafted message in a read-only textarea with
 * Copy. The draft is NEVER auto-sent: the human edits it, then marks the nudge
 * done or dismisses it. In preview/readOnly mode the actions are disabled (no
 * database to act against) and a note explains why.
 *
 * Cards are ordered overdue → due → upcoming so the most time-critical nudges
 * sit at the top.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  markFollowUpDoneAction,
  dismissFollowUpAction,
  refreshFollowUpsAction,
} from "@/app/actions/followup";
import type {
  FollowUpKind,
  FollowUpUrgency,
  FollowUpView,
} from "@/lib/followup/types";
import {
  ActionFeedback,
  useActionFeedback,
} from "@/components/action-feedback";

type BadgeVariant =
  | "muted"
  | "default"
  | "outline"
  | "warning"
  | "success"
  | "danger"
  | "accent";

const KIND_LABEL: Record<FollowUpKind, string> = {
  APPLICATION_NUDGE: "Application nudge",
  INTERVIEW_THANK_YOU: "Thank-you",
  POST_INTERVIEW_CHECKIN: "Check-in",
  OFFER_RESPONSE: "Offer response",
};

// Urgency carries the colour; overdue is the strongest (danger).
const URGENCY_VARIANT: Record<FollowUpUrgency, BadgeVariant> = {
  overdue: "danger",
  due: "warning",
  upcoming: "muted",
};

const URGENCY_LABEL: Record<FollowUpUrgency, string> = {
  overdue: "Overdue",
  due: "Due now",
  upcoming: "Upcoming",
};

// Overdue first, then due, then upcoming.
const URGENCY_ORDER: Record<FollowUpUrgency, number> = {
  overdue: 0,
  due: 1,
  upcoming: 2,
};

const ACT_TOOLTIP = "preview - connect a database to act";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// --- Card ------------------------------------------------------------------

function FollowUpCard({
  item,
  readOnly,
  onError,
}: {
  item: FollowUpView;
  readOnly: boolean;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  const draft = `Subject: ${item.draftSubject}\n\n${item.draftBody}`;

  function act(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    if (readOnly) return;
    startTransition(async () => {
      const result = await fn(item.id);
      if (!result.ok) {
        onError(result.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) - silently no-op.
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-opacity",
        pending && "opacity-60",
      )}
    >
      {/* Header: company/role + tags */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {item.company}
          </div>
          {item.jobTitle && (
            <div className="truncate text-xs text-muted-foreground">
              {item.jobTitle}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {KIND_LABEL[item.kind]}
          </Badge>
          <Badge variant={URGENCY_VARIANT[item.urgency]} className="text-[10px]">
            {URGENCY_LABEL[item.urgency]}
          </Badge>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Due {fmtDate(item.dueAt)} · {item.rationale}
      </p>

      {/* Drafted message - read-only; the human edits it in their mail client. */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Drafted message
          </span>
          <Button size="sm" variant="ghost" onClick={copyDraft} className="h-7 px-2">
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
        </div>
        <textarea
          readOnly
          value={draft}
          rows={6}
          className="w-full resize-y rounded-lg border border-border bg-background p-3 text-sm leading-relaxed text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Actions - disabled in preview/readOnly mode. */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="accent"
          disabled={readOnly || pending}
          title={readOnly ? ACT_TOOLTIP : undefined}
          onClick={() => act(markFollowUpDoneAction)}
        >
          <Check className="h-3.5 w-3.5" />
          Mark done
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly || pending}
          title={readOnly ? ACT_TOOLTIP : undefined}
          onClick={() => act(dismissFollowUpAction)}
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// --- List ------------------------------------------------------------------

export function FollowUpList({
  items,
  readOnly,
}: {
  items: FollowUpView[];
  readOnly: boolean;
}) {
  const [refreshing, startRefresh] = useTransition();
  const router = useRouter();
  const { feedback, run, dismiss, setFeedback } = useActionFeedback();

  const sorted = [...items].sort(
    (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency],
  );

  function refresh() {
    if (readOnly) return;
    startRefresh(async () => {
      const result = await run(() => refreshFollowUpsAction(), {
        errorMessage: "Could not refresh follow-ups",
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <section>
      <ActionFeedback message={feedback} onDismiss={dismiss} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {sorted.length === 0
            ? "No follow-ups due."
            : `${sorted.length} drafted ${sorted.length === 1 ? "nudge" : "nudges"}.`}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={refresh}
          disabled={readOnly || refreshing}
          title={readOnly ? "connect a database to refresh" : undefined}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {readOnly && (
        <p className="mb-3 rounded-lg border border-dashed border-border bg-card/50 p-3 text-xs text-muted-foreground">
          Sample preview - connect a database to act on your real follow-ups.
        </p>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          Nothing due right now. New nudges appear as you apply and interview.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((item) => (
            <FollowUpCard
              key={item.id}
              item={item}
              readOnly={readOnly}
              onError={setFeedback}
            />
          ))}
        </div>
      )}
    </section>
  );
}
