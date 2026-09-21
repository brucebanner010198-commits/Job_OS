/**
 * Server action error boundary and execution wrapper.
 * Traps thrown exceptions, correlates them with trace IDs, logs structured diagnostics,
 * and returns safe, typed payloads for client consumption.
 */

import { logger } from "@/lib/observability/logger";
import { JobOSError, type JobOSErrorPayload } from "@/lib/errors/job-os-error";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: JobOSErrorPayload };

export async function safeAction<T>(
  context: {
    domain: string;
    location: string;
    actionName?: string;
  },
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: unknown) {
    const jobError = JobOSError.wrap(err, {
      domain: context.domain,
      location: context.location,
      fallbackReason: "ACTION_FAILED",
      fallbackMessage:
        err instanceof Error ? err.message : "An unexpected server action error occurred.",
      remedy: "Check the action parameters and server logs using the trace ID below.",
    });

    logger.error(jobError.message, {
      requestId: jobError.traceId,
      domain: jobError.domain,
      code: jobError.code,
      reason: jobError.reason,
      location: jobError.location,
      remedy: jobError.remedy,
      metadata: jobError.metadata,
      stack: jobError.stack,
    });

    return {
      ok: false,
      error: jobError.toPayload(),
    };
  }
}

export function unwrapActionResult<T>(result: ActionResult<T>): T {
  if (result.ok) {
    return result.data;
  }
  const err = new JobOSError({
    code: result.error.code,
    domain: result.error.domain,
    reason: result.error.reason,
    location: result.error.location,
    message: result.error.message,
    remedy: result.error.remedy,
    metadata: result.error.metadata,
    traceId: result.error.traceId,
  });
  throw err;
}
