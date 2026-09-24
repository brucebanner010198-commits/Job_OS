/**
 * Privacy ledger writer. Records metadata about every model call (where the
 * data went, how much, whether it was redacted), never the content.
 *
 * Writes are best-effort: a ledger failure must never break the feature that
 * triggered it, so errors are swallowed after a single warning.
 */
import { db } from "@/lib/db";

export interface LedgerRecord {
  kind: "ai" | "http";
  purpose: string;
  provider: string;
  model?: string;
  destination: string;
  local: boolean;
  redacted?: boolean;
  bytesOut: number;
  bytesIn?: number;
  durationMs: number;
  ok: boolean;
  errorReason?: string;
}

let warned = false;
const pending = new Set<Promise<unknown>>();

export function recordToLedger(entry: LedgerRecord): void {
  const write = db.privacyLedgerEntry
    .create({ data: { ...entry, redacted: entry.redacted ?? false, bytesIn: entry.bytesIn ?? 0 } })
    .catch((err: unknown) => {
      if (warned) return;
      warned = true;
      console.warn("[privacy-ledger] write failed; further failures are silent:", (err as Error).message);
    })
    .finally(() => pending.delete(write));
  pending.add(write);
}

/** Short-lived processes (scheduler, CLI scripts) await this before exiting. */
export async function flushLedger(): Promise<void> {
  await Promise.allSettled([...pending]);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "unknown";
  }
}

export function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}
