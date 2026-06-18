"use client";

import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface ActionFeedbackProps {
  message: string | null;
  variant?: "error" | "success";
  onDismiss?: () => void;
  className?: string;
}

/** Inline banner for server-action failures (track / warm / followup). */
export function ActionFeedback({
  message,
  variant = "error",
  onDismiss,
  className,
}: ActionFeedbackProps) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm",
        variant === "error"
          ? "border-[var(--danger)]/30 bg-[var(--danger)]/10 text-[var(--danger)]"
          : "border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]",
        className,
      )}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/** Hook: run an async action and surface { ok: false } as a user-visible message. */
export function useActionFeedback() {
  const [feedback, setFeedback] = useState<string | null>(null);

  const run = useCallback(
    async <T extends ActionResult>(
      action: () => Promise<T>,
      opts?: { successMessage?: string; errorMessage?: string },
    ): Promise<T> => {
      setFeedback(null);
      try {
        const result = await action();
        if (!result.ok) {
          setFeedback(
            result.error ??
              opts?.errorMessage ??
              "Something went wrong. Please try again.",
          );
        } else if (opts?.successMessage) {
          setFeedback(opts.successMessage);
        }
        return result;
      } catch {
        setFeedback(opts?.errorMessage ?? "Something went wrong. Please try again.");
        return { ok: false } as T;
      }
    },
    [],
  );

  const dismiss = useCallback(() => setFeedback(null), []);

  return { feedback, run, dismiss, setFeedback };
}
