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

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
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
