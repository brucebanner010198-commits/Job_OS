/**
 * Incremental Gmail sync planning (Phase 6, plan §8d / Hardening §F) - pure
 * helpers that decide HOW to pull (full vs. incremental), advance the historyId
 * watermark, and keep re-sync idempotent. No DB, no network, no LLM; the caller
 * passes any "now" in as an ISO string so the logic is deterministic.
 *
 * Idempotency spine: dedupeNewEmails drops anything already seen by Gmail
 * message id, so a re-run over an overlapping history window never double-files
 * an email into a proposal.
 */
import type { RawEmail, SyncState, SyncPlan } from "@/lib/track/types";

/**
 * Default Gmail search query that biases the full pull toward job-search mail
 * while dropping obvious bulk/promotional noise. The classifier still has the
 * final say - this only narrows the firehose.
 */
const DEFAULT_QUERY =
  "newer_than:30d (interview OR application OR applying OR recruiter OR " +
  "recruiting OR assessment OR offer OR \"thank you for applying\") " +
  "-category:promotions";

const DEFAULT_LOOKBACK_DAYS = 30;

/**
 * Decide the sync mode. With no historyId watermark we do a "full" lookback
 * pull; once we have one, we fetch incrementally since that id. lookbackDays and
 * query fall back to job-biased defaults when not overridden.
 */
export function planSync(
  state: SyncState,
  opts?: { lookbackDays?: number; query?: string },
): SyncPlan {
  const lookbackDays = opts?.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
  const query = opts?.query ?? DEFAULT_QUERY;

  if (!state.historyId) {
    return { mode: "full", lookbackDays, query };
  }
  return {
    mode: "incremental",
    sinceHistoryId: state.historyId,
    lookbackDays,
    query,
  };
}

/**
 * Advance the sync watermark. historyId moves to the numerically-larger of the
 * previous and incoming ids when both parse as numbers (Gmail history ids are
 * monotonic decimal strings); otherwise it takes the new id when present, or
 * keeps the previous one. lastSyncedAt is always stamped with the passed-in now.
 */
export function nextSyncState(
  prev: SyncState,
  newHistoryId: string | undefined,
  nowIso: string,
): SyncState {
  let historyId: string | undefined;

  const prevNum = prev.historyId === undefined ? NaN : Number(prev.historyId);
  const newNum = newHistoryId === undefined ? NaN : Number(newHistoryId);

  if (
    prev.historyId !== undefined &&
    newHistoryId !== undefined &&
    Number.isFinite(prevNum) &&
    Number.isFinite(newNum)
  ) {
    historyId = newNum > prevNum ? newHistoryId : prev.historyId;
  } else if (newHistoryId !== undefined) {
    historyId = newHistoryId;
  } else {
    historyId = prev.historyId;
  }

  return { historyId, lastSyncedAt: nowIso };
}

/**
 * Idempotent re-sync filter: keep only fetched emails whose gmailMessageId is
 * NOT already in the seen set. Input order is preserved.
 */
export function dedupeNewEmails(
  seenMessageIds: Iterable<string>,
  fetched: RawEmail[],
): RawEmail[] {
  const seen = new Set<string>(seenMessageIds);
  return fetched.filter((email) => !seen.has(email.gmailMessageId));
}
