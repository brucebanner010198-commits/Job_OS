/**
 * Structured JSON logger for server-side observability (Phase 4A).
 * Emits one JSON object per line to stdout for local log aggregation.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  domain?: string;
  [key: string]: unknown;
}

const SENSITIVE_KEY_PATTERN = /(token|secret|password|authorization|cookie|key|credential)/i;

function sanitizeValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (SENSITIVE_KEY_PATTERN.test(key) && typeof value === "string") {
    return "[REDACTED]";
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }
  if (typeof value === "object") {
    const sanitizedObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      sanitizedObj[k] = SENSITIVE_KEY_PATTERN.test(k) && typeof v === "string" ? "[REDACTED]" : sanitizeValue(k, v);
    }
    return sanitizedObj;
  }
  return value;
}

function sanitizeFields(fields?: LogFields): LogFields | undefined {
  if (!fields) return undefined;
  const cleaned: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    cleaned[k] = SENSITIVE_KEY_PATTERN.test(k) && typeof v === "string" ? "[REDACTED]" : sanitizeValue(k, v);
  }
  return cleaned;
}

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const sanitized = sanitizeFields(fields);
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...sanitized,
  };
  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug(message: string, fields?: LogFields): void {
    emit("debug", message, fields);
  },
  info(message: string, fields?: LogFields): void {
    emit("info", message, fields);
  },
  warn(message: string, fields?: LogFields): void {
    emit("warn", message, fields);
  },
  error(message: string, fields?: LogFields): void {
    emit("error", message, fields);
  },
};

/** Startup warnings (document only; never block localhost). */
export function logStartupWarnings(): void {
  if (!process.env.JOB_OS_ACCESS_TOKEN?.trim()) {
    logger.warn(
      "JOB_OS_ACCESS_TOKEN is not set; non-loopback hosts accept requests without an access token",
      { domain: "startup" },
    );
  }
}
