/**
 * Backup pipeline (Phase 11) - pure assembly of the BackupView the /backups page
 * renders, plus an offline preview. No DB, no fs, no clock: the service hands in
 * the records + key source + now, and this composes the schedule status and
 * totals. previewBackup() lets the page render identically with no database.
 */
import { scheduleStatus } from "@/lib/backup/snapshot";
import { fixtureRecords } from "@/lib/backup/fixtures";
import {
  BACKUP_INTERVAL_SEC,
  type BackupRecord,
  type BackupView,
  type KeySource,
} from "@/lib/backup/types";

export function processBackupView(input: {
  records: BackupRecord[];
  keySource: KeySource;
  backupDir: string;
  nowIso: string;
  intervalSec?: number;
}): BackupView {
  const intervalSec = input.intervalSec ?? BACKUP_INTERVAL_SEC;
  // Records arrive newest-first; latest drives the schedule + totals.
  const sorted = [...input.records].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
  const latest = sorted[0];
  return {
    backups: sorted,
    latest,
    totalEntries: latest?.entryCount ?? 0,
    totalNotes: latest?.noteCount ?? 0,
    keySource: input.keySource,
    backupDir: input.backupDir,
    schedule: scheduleStatus(latest?.createdAt, input.nowIso, intervalSec),
    generatedAt: input.nowIso,
  };
}

/** Offline preview used when Postgres is unreachable or there are no backups. */
export function previewBackup(nowIso = "2026-06-17T12:30:00.000Z"): BackupView {
  return processBackupView({
    records: fixtureRecords,
    keySource: "app-key",
    backupDir: "<app>/.backups",
    nowIso,
  });
}
