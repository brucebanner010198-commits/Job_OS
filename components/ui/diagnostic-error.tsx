"use client";

/**
 * Diagnostic error display component following Google error presentation standards.
 * Displays human-friendly guidance with collapsible technical diagnostics and a one-click copy button.
 */

import { useState } from "react";
import { AlertCircle, ChevronDown, ChevronRight, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobOSErrorPayload } from "@/lib/errors/job-os-error";
import { cn } from "@/lib/utils";

export interface DiagnosticErrorProps {
  error: Error | JobOSErrorPayload | string | null | undefined;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

function parseErrorDetails(error: Error | JobOSErrorPayload | string): {
  message: string;
  code?: string;
  domain?: string;
  reason?: string;
  location?: string;
  remedy?: string;
  traceId?: string;
  metadata?: Record<string, unknown>;
} {
  if (typeof error === "string") {
    return { message: error };
  }

  // JobOSErrorPayload
  if ("code" in error && "domain" in error) {
    return {
      message: error.message,
      code: error.code,
      domain: error.domain,
      reason: error.reason,
      location: error.location,
      remedy: error.remedy,
      traceId: error.traceId,
      metadata: error.metadata,
    };
  }

  // Standard Error or custom object
  const errObj = error as unknown as Record<string, unknown>;
  return {
    message: error.message || "An unexpected error occurred.",
    code: typeof errObj.code === "string" ? errObj.code : undefined,
    domain: typeof errObj.domain === "string" ? errObj.domain : undefined,
    reason: typeof errObj.reason === "string" ? errObj.reason : undefined,
    location: typeof errObj.location === "string" ? errObj.location : undefined,
    remedy: typeof errObj.remedy === "string" ? errObj.remedy : undefined,
    traceId: typeof errObj.traceId === "string" ? errObj.traceId : typeof errObj.digest === "string" ? errObj.digest : undefined,
    metadata: typeof errObj.metadata === "object" && errObj.metadata !== null ? (errObj.metadata as Record<string, unknown>) : undefined,
  };
}

export function DiagnosticError({
  error,
  title = "Action failed",
  onRetry,
  className,
}: DiagnosticErrorProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const details = parseErrorDetails(error);

  function handleCopyReport() {
    const lines = [
      `=== Job OS Diagnostic Report ===`,
      `Message:     ${details.message}`,
    ];

    if (details.code) lines.push(`Code:        ${details.code}`);
    if (details.domain) lines.push(`Subsystem:   ${details.domain}`);
    if (details.reason) lines.push(`Reason:      ${details.reason}`);
    if (details.location) lines.push(`Location:    ${details.location}`);
    if (details.traceId) lines.push(`Trace ID:    ${details.traceId}`);
    if (details.remedy) lines.push(`Remedy:      ${details.remedy}`);

    if (details.metadata) {
      lines.push(`Metadata:`);
      for (const [k, v] of Object.entries(details.metadata)) {
        lines.push(`  ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
      }
    }

    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const hasTechnicalDetails =
    details.code || details.domain || details.location || details.traceId || details.reason;

  return (
    <div
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-left",
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-destructive">{title}</h3>
            {details.code && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-destructive">
                {details.code}
              </span>
            )}
          </div>

          <p className="text-sm text-foreground/90">{details.message}</p>

          {details.remedy && (
            <div className="rounded-md bg-background/80 border border-border/50 p-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Suggested fix: </span>
              {details.remedy}
            </div>
          )}

          {hasTechnicalDetails && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
              >
                {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                {expanded ? "Hide diagnostic details" : "Show diagnostic details"}
              </button>

              {expanded && (
                <div className="mt-2 space-y-1.5 rounded bg-muted/60 p-3 font-mono text-xs text-foreground/80 border border-border/40">
                  {details.domain && (
                    <div>
                      <span className="text-muted-foreground">Subsystem: </span>
                      <span>{details.domain}</span>
                    </div>
                  )}
                  {details.reason && (
                    <div>
                      <span className="text-muted-foreground">Reason: </span>
                      <span>{details.reason}</span>
                    </div>
                  )}
                  {details.location && (
                    <div>
                      <span className="text-muted-foreground">Location: </span>
                      <span>{details.location}</span>
                    </div>
                  )}
                  {details.traceId && (
                    <div>
                      <span className="text-muted-foreground">Trace ID: </span>
                      <span>{details.traceId}</span>
                    </div>
                  )}
                  {details.metadata && (
                    <div className="pt-1">
                      <span className="text-muted-foreground">Metadata: </span>
                      <pre className="mt-1 overflow-x-auto text-[11px]">
                        {JSON.stringify(details.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyReport}
              className="h-7 text-xs gap-1.5"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Report copied" : "Copy diagnostic report"}
            </Button>

            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
