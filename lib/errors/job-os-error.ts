/**
 * Structured application error following Google's canonical error architecture.
 * Captures canonical status codes, exact code locations, machine-readable reasons,
 * correlation trace IDs, and actionable remedies.
 */

import { randomBytes } from "node:crypto";
import type { CanonicalErrorCode } from "@/lib/errors/canonical-codes";

export interface JobOSErrorOptions {
  code: CanonicalErrorCode;
  domain: string;
  reason: string;
  location: string;
  message: string;
  remedy?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  cause?: unknown;
}

export interface JobOSErrorPayload {
  code: CanonicalErrorCode;
  domain: string;
  reason: string;
  location: string;
  message: string;
  remedy?: string;
  metadata?: Record<string, unknown>;
  traceId: string;
  timestamp: string;
}

export class JobOSError extends Error {
  public readonly code: CanonicalErrorCode;
  public readonly domain: string;
  public readonly reason: string;
  public readonly location: string;
  public readonly remedy?: string;
  public readonly metadata?: Record<string, unknown>;
  public readonly traceId: string;
  public readonly timestamp: string;

  constructor(options: JobOSErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "JobOSError";
    this.code = options.code;
    this.domain = options.domain;
    this.reason = options.reason;
    this.location = options.location;
    this.remedy = options.remedy;
    this.metadata = options.metadata;
    this.traceId = options.traceId ?? `trace_${randomBytes(6).toString("hex")}`;
    this.timestamp = new Date().toISOString();

    // Ensure proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toPayload(): JobOSErrorPayload {
    return {
      code: this.code,
      domain: this.domain,
      reason: this.reason,
      location: this.location,
      message: this.message,
      remedy: this.remedy,
      metadata: this.metadata,
      traceId: this.traceId,
      timestamp: this.timestamp,
    };
  }

  public toDiagnosticReport(): string {
    const lines = [
      `=== Job OS Diagnostic Report ===`,
      `Trace ID:    ${this.traceId}`,
      `Timestamp:   ${this.timestamp}`,
      `Status Code: ${this.code}`,
      `Subsystem:   ${this.domain}`,
      `Reason:      ${this.reason}`,
      `Location:    ${this.location}`,
      `Message:     ${this.message}`,
    ];

    if (this.remedy) {
      lines.push(`Remedy:      ${this.remedy}`);
    }

    if (this.metadata && Object.keys(this.metadata).length > 0) {
      lines.push(`Metadata:`);
      for (const [key, value] of Object.entries(this.metadata)) {
        lines.push(`  ${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`);
      }
    }

    if (this.stack) {
      lines.push(`Stack:`);
      lines.push(this.stack);
    }

    if (this.cause) {
      lines.push(`Underlying Cause: ${String(this.cause)}`);
    }

    return lines.join("\n");
  }

  public static invalidArgument(options: {
    domain: string;
    reason: string;
    location: string;
    message: string;
    remedy?: string;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }): JobOSError {
    return new JobOSError({ ...options, code: "INVALID_ARGUMENT" });
  }

  public static failedPrecondition(options: {
    domain: string;
    reason: string;
    location: string;
    message: string;
    remedy?: string;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }): JobOSError {
    return new JobOSError({ ...options, code: "FAILED_PRECONDITION" });
  }

  public static notFound(options: {
    domain: string;
    reason: string;
    location: string;
    message: string;
    remedy?: string;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }): JobOSError {
    return new JobOSError({ ...options, code: "NOT_FOUND" });
  }

  public static unavailable(options: {
    domain: string;
    reason: string;
    location: string;
    message: string;
    remedy?: string;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }): JobOSError {
    return new JobOSError({ ...options, code: "UNAVAILABLE" });
  }

  public static internal(options: {
    domain: string;
    reason: string;
    location: string;
    message: string;
    remedy?: string;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }): JobOSError {
    return new JobOSError({ ...options, code: "INTERNAL" });
  }

  public static dataLoss(options: {
    domain: string;
    reason: string;
    location: string;
    message: string;
    remedy?: string;
    metadata?: Record<string, unknown>;
    cause?: unknown;
  }): JobOSError {
    return new JobOSError({ ...options, code: "DATA_LOSS" });
  }

  public static wrap(
    err: unknown,
    context: {
      domain: string;
      location: string;
      fallbackReason?: string;
      fallbackMessage?: string;
      remedy?: string;
      metadata?: Record<string, unknown>;
    },
  ): JobOSError {
    if (err instanceof JobOSError) {
      return err;
    }

    const rawMessage = err instanceof Error ? err.message : String(err);
    return new JobOSError({
      code: "INTERNAL",
      domain: context.domain,
      reason: context.fallbackReason ?? "UNEXPECTED_ERROR",
      location: context.location,
      message: context.fallbackMessage ?? rawMessage,
      remedy: context.remedy,
      metadata: {
        ...context.metadata,
        rawError: rawMessage,
      },
      cause: err,
    });
  }
}
