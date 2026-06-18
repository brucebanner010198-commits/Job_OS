/**
 * Inbox proposals queue (Phase 6, plan §8d). Renders the pending Gmail-derived
 * StatusProposals as confirm/dismiss cards - the human gate before any status
 * change lands. "Sync inbox" pulls + classifies new mail; Confirm/Dismiss
 * commit or drop a single proposal. Everything is disabled in preview/readOnly
 * mode (no database to act against).
 */
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  syncInboxAction,
  confirmProposalAction,
  dismissProposalAction,
} from "@/app/actions/track";
import type { AppStatus, EmailCategory, ProposalView } from "@/lib/track/types";
import {
  ActionFeedback,
  useActionFeedback,
} from "@/components/action-feedback";
import { RejectionExplanationPanel } from "@/components/track/rejection-explanation-panel";

type BadgeVariant = "muted" | "default" | "warning" | "success" | "danger" | "accent";

// Interview/offer read as good news (success); rejections read as bad (danger);
// everything else is a neutral signal.
const CATEGORY_VARIANT: Record<EmailCategory, BadgeVariant> = {
  INTERVIEW_INVITE: "success",
  OFFER: "success",
  REJECTION: "danger",
  SOFT_REJECTION: "danger",
  ASSESSMENT: "muted",
  RECRUITER_OUTREACH: "muted",
  APPLICATION_RECEIVED: "muted",
  NOT_JOB: "muted",
};

const CATEGORY_LABEL: Record<EmailCategory, string> = {
  INTERVIEW_INVITE: "Interview invite",
  ASSESSMENT: "Assessment",
  RECRUITER_OUTREACH: "Recruiter outreach",
  APPLICATION_RECEIVED: "Application received",
  SOFT_REJECTION: "Soft rejection",
  REJECTION: "Rejection",
  OFFER: "Offer",
  NOT_JOB: "Not job-related",
};

const STATUS_VARIANT: Record<AppStatus, BadgeVariant> = {
  WARM_PATH: "accent",
  TO_APPLY: "muted",
  APPLIED: "default",
  INTERVIEWING: "warning",
  OFFER: "success",
  REJECTED: "danger",
  SKIPPED: "muted",
};

const STATUS_LABEL: Record<AppStatus, string> = {
  WARM_PATH: "Warm path",
  TO_APPLY: "To apply",
  APPLIED: "Applied",
  INTERVIEWING: "Interviewing",
  OFFER: "Offer",
  REJECTED: "Rejected",
  SKIPPED: "Skipped",
};

const ACT_TOOLTIP = "preview - connect a database to act";

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// --- Proposal card ------------------------------------------------------------

function ProposalCard({
  proposal,
  readOnly,
  onError,
}: {
  proposal: ProposalView;
  readOnly: boolean;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const isRejectionProposal =
    proposal.toStatus === "REJECTED" ||
    proposal.category === "REJECTION" ||
    proposal.category === "SOFT_REJECTION";
  const rejectionEmailText = [
    proposal.subject,
    proposal.snippet ?? "",
    proposal.rationale,
  ].join(" ");

  function act(fn: (id: string) => Promise<{ ok: boolean; error?: string }>) {
    if (readOnly) return;
    startTransition(async () => {
      const result = await fn(proposal.id);
      if (!result.ok) {
        onError(result.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-opacity",
        pending && "opacity-60",
      )}
    >
      {/* Tags */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={CATEGORY_VARIANT[proposal.category]} className="text-[10px]">
          {CATEGORY_LABEL[proposal.category]}
        </Badge>
        {proposal.soft && (
          <Badge variant="muted" className="text-[10px]">
            soft rejection
          </Badge>
        )}
        {proposal.requiresConfirm && (
          <span className="rounded-full bg-[var(--warning)]/12 px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]">
            needs your confirmation
          </span>
        )}
        {proposal.company && (
          <span className="text-xs text-muted-foreground">· {proposal.company}</span>
        )}
      </div>

      {/* Source email */}
      <p className="mt-2 text-sm font-medium text-foreground">{proposal.subject}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {proposal.fromEmail} · {fmt(proposal.receivedAt)}
      </p>

      {/* Proposed move */}
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-muted-foreground">
          {proposal.fromStatus ? STATUS_LABEL[proposal.fromStatus] : "-"}
        </span>
        <span className="text-muted-foreground">→</span>
        <Badge variant={STATUS_VARIANT[proposal.toStatus]} className="text-[10px]">
          {STATUS_LABEL[proposal.toStatus]}
        </Badge>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">{proposal.rationale}</p>

      {/* Parsed interview time */}
      {proposal.eventStart && (
        <p
          className={cn(
            "mt-2 text-xs",
            proposal.eventCancelled
              ? "text-muted-foreground line-through"
              : "text-foreground",
          )}
        >
          Interview {fmt(proposal.eventStart)}
          {proposal.eventCancelled ? " (canceled)" : ""}
        </p>
      )}

      {isRejectionProposal && (
        <RejectionExplanationPanel emailText={rejectionEmailText} />
      )}

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="accent"
          disabled={readOnly || pending}
          title={readOnly ? ACT_TOOLTIP : undefined}
          onClick={() => act(confirmProposalAction)}
        >
          <Check className="h-3.5 w-3.5" />
          Confirm
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={readOnly || pending}
          title={readOnly ? ACT_TOOLTIP : undefined}
          onClick={() => act(dismissProposalAction)}
        >
          <X className="h-3.5 w-3.5" />
          Dismiss
        </Button>
      </div>
    </div>
  );
}

// --- Queue --------------------------------------------------------------------

export function InboxProposals({
  proposals,
  readOnly,
}: {
  proposals: ProposalView[];
  readOnly: boolean;
}) {
  const [syncing, startSync] = useTransition();
  const router = useRouter();
  const { feedback, run, dismiss, setFeedback } = useActionFeedback();

  function sync() {
    if (readOnly) return;
    startSync(async () => {
      const result = await run(() => syncInboxAction(), {
        errorMessage: "Inbox sync failed",
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <section className="mt-6">
      <ActionFeedback message={feedback} onDismiss={dismiss} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium">Inbox proposals</h2>
          <p className="text-xs text-muted-foreground">
            Gmail-detected changes waiting for your confirmation.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={sync}
          disabled={readOnly || syncing}
          title={readOnly ? "connect a database to sync" : undefined}
          className="shrink-0"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
          Sync inbox
        </Button>
      </div>

      {proposals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
          No pending proposals. Sync your inbox to check for updates.
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              readOnly={readOnly}
              onError={setFeedback}
            />
          ))}
        </div>
      )}
    </section>
  );
}
