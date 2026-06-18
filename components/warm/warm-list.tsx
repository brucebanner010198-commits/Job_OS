/**
 * Warm-path list (Phase 7, plan §9 + Module 9). Renders the ranked paths-in as
 * review cards - the human-in-the-loop, draft-first surface for the referral
 * engine. Each card shows the path strength, the real connection it runs
 * through, why it ranked, and (when there's a genuine path) an EXTRACTIVE intro
 * DRAFT in a read-only textarea with Copy / Generate / Mark-sent / Skip.
 *
 * Safety spine enforced in the UI:
 *   - DRAFT-FIRST: nothing is ever auto-sent. "Mark sent" only records that the
 *     human sent it from their own account; the engine never sends.
 *   - TRUTHFUL / EXTRACTIVE: when a draft couldn't be fully grounded
 *     (provenanceOk === false) a warning banner shows and "Mark sent" is
 *     DISABLED - the user must review before the draft can be treated as sent.
 *   - ETIQUETTE: when there's no genuine path (reachOut false / NONE) the card
 *     shows "apply directly" and offers NO draft, rather than fabricating a tie.
 *   - readOnly (sample preview) disables every action - the list is look-only.
 */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Copy,
  Check,
  Send,
  X,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  refreshConnectionsAction,
  generateIntroAction,
  markIntroSentAction,
  skipIntroAction,
} from "@/app/actions/warm";
import type { PathKind, WarmPathView } from "@/lib/warm/types";
import {
  ActionFeedback,
  useActionFeedback,
} from "@/components/action-feedback";

type BadgeVariant = "muted" | "default" | "warning" | "success" | "danger" | "accent";

// Strong, first-degree paths read as good news (success); weaker but genuine
// ties read as accent/default; NONE is neutral muted.
const PATH_VARIANT: Record<PathKind, BadgeVariant> = {
  CURRENT_COLLEAGUE: "success",
  FORMER_COLLEAGUE: "success",
  ALUMNI: "accent",
  MUTUAL_CONNECTION: "accent",
  COMMUNITY: "default",
  FRIEND: "default",
  NONE: "muted",
};

const PATH_LABEL: Record<PathKind, string> = {
  CURRENT_COLLEAGUE: "Current colleague",
  FORMER_COLLEAGUE: "Former colleague",
  ALUMNI: "Alumni",
  MUTUAL_CONNECTION: "Mutual connection",
  COMMUNITY: "Community",
  FRIEND: "Friend",
  NONE: "No path",
};

const READONLY_TOOLTIP = "sample preview - connect a database to act";

// --- Refresh-connections affordance -------------------------------------------

/**
 * Re-discovers the user's network from the active ConnectionSource and re-ranks.
 * Disabled in preview/readOnly mode (no database to write into).
 */
export function RefreshConnections({ readOnly }: { readOnly: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { feedback, run, dismiss } = useActionFeedback();

  function refresh() {
    if (readOnly) return;
    startTransition(async () => {
      const result = await run(() => refreshConnectionsAction(), {
        errorMessage: "Could not refresh connections",
      });
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <ActionFeedback message={feedback} onDismiss={dismiss} className="mb-0 w-full" />
      <Button
      size="sm"
      variant="outline"
      onClick={refresh}
      disabled={readOnly || pending}
      title={readOnly ? "connect a database to refresh" : undefined}
      className="shrink-0"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
      Refresh connections
    </Button>
    </div>
  );
}

// --- Warm-path card ------------------------------------------------------------

function WarmPathCard({
  path,
  readOnly,
  onError,
}: {
  path: WarmPathView;
  readOnly: boolean;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const router = useRouter();

  // The etiquette gate: no genuine path → recommend applying cold, no draft.
  const noPath = !path.reachOut || path.pathKind === "NONE";
  const hasDraft = Boolean(path.draftBody);
  const provenanceBlocked = path.provenanceOk === false;
  const strengthPct = Math.round((path.strength ?? 0) * 100);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (readOnly) return;
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        onError(result.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  function copy() {
    const text = [path.draftSubject, path.draftBody].filter(Boolean).join("\n\n");
    if (!text || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 transition-opacity",
        pending && "opacity-60",
      )}
    >
      {/* Company + role + path badge */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">
            {path.company}
          </div>
          {path.jobTitle && (
            <div className="truncate text-xs text-muted-foreground">
              {path.jobTitle}
            </div>
          )}
        </div>
        <Badge variant={PATH_VARIANT[path.pathKind]} className="shrink-0 text-[10px]">
          {PATH_LABEL[path.pathKind]}
          {path.pathKind !== "NONE" && ` · ${strengthPct}%`}
        </Badge>
      </div>

      {/* The real connection this path runs through */}
      {path.connectionName && (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {path.connectionName}
          </span>
          {path.connectionHeadline && <> - {path.connectionHeadline}</>}
          {path.connectionProfileUrl && (
            <a
              href={path.connectionProfileUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-1 inline-flex items-center gap-0.5 text-accent hover:underline"
            >
              profile
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </p>
      )}

      {/* Why it ranked */}
      {path.reasons.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {path.reasons.map((reason, i) => (
            <li key={i} className="text-xs text-muted-foreground">
              · {reason}
            </li>
          ))}
        </ul>
      )}

      {noPath ? (
        /* No genuine path - recommend applying cold, offer no draft. */
        <p className="mt-3 rounded-lg border border-dashed border-border bg-background p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            No warm path - apply directly.
          </span>{" "}
          {path.gateReason}
        </p>
      ) : (
        <>
          {/* Provenance warning - blocks "mark sent" below. */}
          {provenanceBlocked && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3 text-xs text-[var(--warning)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Draft could not be fully grounded - review before sending.
              </span>
            </div>
          )}

          {/* The extractive draft, read-only */}
          {hasDraft ? (
            <div className="mt-3">
              {path.draftSubject && (
                <p className="mb-1 text-xs font-medium text-foreground">
                  Subject: {path.draftSubject}
                </p>
              )}
              <textarea
                readOnly
                rows={6}
                value={path.draftBody ?? ""}
                className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground"
              />
              <div className="mt-1 flex justify-end">
                <Button size="sm" variant="ghost" type="button" onClick={copy}>
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              No draft yet - generate an intro to get a grounded first draft.
            </p>
          )}

          {/* Actions - all called inside onClick handlers, never a form action. */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="accent"
              disabled={readOnly || pending}
              title={readOnly ? READONLY_TOOLTIP : undefined}
              onClick={() =>
                act(() =>
                  generateIntroAction(path.company, path.applicationId ?? null),
                )
              }
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {hasDraft ? "Regenerate" : "Generate intro"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={readOnly || pending || provenanceBlocked || !hasDraft}
              title={
                provenanceBlocked
                  ? "draft not grounded - review before sending"
                  : readOnly
                    ? READONLY_TOOLTIP
                    : undefined
              }
              onClick={() => act(() => markIntroSentAction(path.id))}
            >
              <Send className="h-3.5 w-3.5" />
              Mark sent
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={readOnly || pending}
              title={readOnly ? READONLY_TOOLTIP : undefined}
              onClick={() => act(() => skipIntroAction(path.id))}
            >
              <X className="h-3.5 w-3.5" />
              Skip
            </Button>
          </div>
        </>
      )}

      {readOnly && (
        <p className="mt-2 text-[11px] text-muted-foreground/70">
          Sample preview - actions are disabled.
        </p>
      )}
    </div>
  );
}

// --- List ----------------------------------------------------------------------

export function WarmList({
  paths,
  readOnly,
}: {
  paths: WarmPathView[];
  readOnly: boolean;
}) {
  const { feedback, setFeedback, dismiss } = useActionFeedback();

  if (paths.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
        No warm paths yet. Refresh your connections to find a path in.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ActionFeedback message={feedback} onDismiss={dismiss} />
      {paths.map((path) => (
        <WarmPathCard
          key={path.id}
          path={path}
          readOnly={readOnly}
          onError={setFeedback}
        />
      ))}
    </div>
  );
}
