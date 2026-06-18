/**
 * Snapshot brain (Phase 11) - PURE and deterministic. No DB, no fs, no crypto
 * keys, no clock (time arrives as an injected ISO string). It turns raw profile
 * rows into a canonical ProfileExport, computes a content hash that ignores
 * timestamps (so an unchanged profile always hashes identically → dedupe), and
 * decides whether a backup is due from the latest snapshot's age.
 *
 * Determinism is the whole point: the same profile must always produce the same
 * contentHash regardless of map/insertion order or when it's run, so the gate
 * can assert it and the service can skip writing duplicate snapshots.
 */
import { sha256Hex } from "@/lib/backup/crypto";
import {
  BACKUP_FORMAT_VERSION,
  type BackupManifest,
  type BackupSchedule,
  type BackupTrigger,
  type ExportedEntry,
  type ExportedNote,
  type ProfileExport,
} from "@/lib/backup/types";

export interface RawProfile {
  user: { name?: string | null; email?: string | null };
  entries: ExportedEntry[];
  notes: ExportedNote[];
}

/** Stable JSON: object keys sorted recursively so serialization is canonical. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** Deterministic ordering for entries (kind, then createdAt, then a tiebreak). */
function sortEntries(entries: ExportedEntry[]): ExportedEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return stableStringify(a.data) < stableStringify(b.data) ? -1 : 1;
  });
}

function sortNotes(notes: ExportedNote[]): ExportedNote[] {
  return [...notes].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.rawText < b.rawText ? -1 : 1;
  });
}

/** Build the canonical ProfileExport from raw rows (entries/notes sorted). */
export function buildExport(raw: RawProfile, nowIso: string): ProfileExport {
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: nowIso,
    user: { name: raw.user.name ?? null, email: raw.user.email ?? null },
    entries: sortEntries(raw.entries),
    notes: sortNotes(raw.notes),
  };
}

/**
 * Content hash of an export - deliberately EXCLUDES exportedAt so two snapshots
 * of an unchanged profile produce the same hash (the dedupe key).
 */
export function contentHash(exp: ProfileExport): string {
  return sha256Hex(
    stableStringify({
      formatVersion: exp.formatVersion,
      user: exp.user,
      entries: exp.entries,
      notes: exp.notes,
    }),
  );
}

export function manifestFor(
  exp: ProfileExport,
  trigger: BackupTrigger,
  nowIso: string,
  label?: string,
): BackupManifest {
  return {
    formatVersion: exp.formatVersion,
    contentHash: contentHash(exp),
    entryCount: exp.entries.length,
    noteCount: exp.notes.length,
    sensitiveCount: exp.entries.filter((e) => e.sensitive).length,
    createdAt: nowIso,
    trigger,
    ...(label ? { label } : {}),
  };
}

/** True when the profile content differs from the most recent snapshot's hash. */
export function needsNewSnapshot(
  latestHash: string | undefined,
  exp: ProfileExport,
): boolean {
  return latestHash !== contentHash(exp);
}

/** Pure schedule health from the latest snapshot's age (no clock read). */
export function scheduleStatus(
  latestBackupAtIso: string | undefined,
  nowIso: string,
  intervalSec: number,
): BackupSchedule {
  if (!latestBackupAtIso) {
    return {
      intervalSec,
      due: true,
      reason: "never backed up - run one now",
    };
  }
  const ageSec = Math.max(
    0,
    (Date.parse(nowIso) - Date.parse(latestBackupAtIso)) / 1000,
  );
  const due = ageSec >= intervalSec;
  return {
    intervalSec,
    lastBackupAt: latestBackupAtIso,
    ageSec,
    due,
    reason: due
      ? `stale - last backup ${humanAge(ageSec)} ago`
      : `fresh - last backup ${humanAge(ageSec)} ago`,
  };
}

/** Compact age formatter (mirrors the scheduler's humanizeDuration intent). */
export function humanAge(sec: number): string {
  if (sec < 90) return `${Math.round(sec)}s`;
  if (sec < 60 * 60) return `${Math.round(sec / 60)}m`;
  if (sec < 36 * 3600) return `${Math.round(sec / 3600)}h`;
  return `${Math.round(sec / 86400)}d`;
}
