/**
 * Backup & export contract (Phase 11, plan Hardening §E: "automated encrypted
 * versioned backups + one-click export of the master profile - it's
 * irreplaceable"). Prisma-free shapes shared by the pure snapshot brain
 * (snapshot.ts), the crypto layer (crypto.ts), the DB+fs service (service.ts),
 * the runner (scripts/backup.ts) and the /backups UI.
 *
 * Design in one line: the master profile is serialized to a canonical
 * ProfileExport, AES-256-GCM encrypted with a local app key, and written as a
 * self-contained envelope to a gitignored /.backups dir - with a plaintext
 * MANIFEST (counts + content hash, never the data) so the UI can list and
 * de-duplicate snapshots without ever decrypting them.
 */

/** Bump when the ProfileExport shape changes in a non-backward-compatible way. */
export const BACKUP_FORMAT_VERSION = 1;

/** Where encrypted snapshots live (gitignored), relative to the app cwd. */
export const BACKUP_DIR = ".backups";

/** Default automated cadence: a daily snapshot is plenty for a personal profile. */
export const BACKUP_INTERVAL_SEC = 24 * 60 * 60;

export type BackupTrigger = "manual" | "scheduled" | "pre-restore";

/** How the encryption key was derived. */
export type BackupKdf = "app-key" | "scrypt";

/** Where the app encryption key came from (for the UI to explain at-rest safety). */
export type KeySource = "env" | "app-key" | "none";

// --- The plaintext payload (this is what gets encrypted) ---------------------

export interface ExportedEntry {
  kind: string;
  data: unknown;
  sourceNote?: string | null;
  sensitive: boolean;
  createdAt: string;
}

export interface ExportedNote {
  rawText: string;
  cleanedText?: string | null;
  source: string;
  createdAt: string;
}

/** The full, DB-decoupled snapshot of a user's master profile. */
export interface ProfileExport {
  formatVersion: number;
  exportedAt: string;
  user: { name?: string | null; email?: string | null };
  entries: ExportedEntry[];
  notes: ExportedNote[];
}

// --- The non-secret manifest (safe to store/show in plaintext) ---------------

export interface BackupManifest {
  formatVersion: number;
  /** sha256 of the CANONICAL content (entries+notes+user) - excludes exportedAt
   *  so an unchanged profile always hashes the same → identical snapshots dedupe. */
  contentHash: string;
  entryCount: number;
  noteCount: number;
  sensitiveCount: number;
  createdAt: string;
  trigger: BackupTrigger;
  label?: string;
}

// --- The self-contained encrypted envelope (the file on disk) ----------------

export interface BackupEnvelope {
  formatVersion: number;
  algo: "aes-256-gcm";
  kdf: BackupKdf;
  /** base64 scrypt salt - present only for kdf="scrypt" (portable exports). */
  salt?: string;
  iv: string; // base64, 12 bytes
  authTag: string; // base64, 16 bytes
  ciphertext: string; // base64
  manifest: BackupManifest;
}

// --- UI / service view models ------------------------------------------------

/** One backup as the DB indexes it (the encrypted blob lives on disk). */
export interface BackupRecord {
  id: string;
  label?: string | null;
  trigger: BackupTrigger;
  contentHash: string;
  entryCount: number;
  noteCount: number;
  sensitiveCount: number;
  byteSize: number;
  /** Basename only in the UI - never the absolute path. */
  fileName: string;
  createdAt: string;
}

export interface RestoreResult {
  ok: boolean;
  restoredEntries: number;
  restoredNotes: number;
  contentHash: string;
  /** A pre-restore safety snapshot is always taken first; its id, if created. */
  safetyBackupId?: string;
  reason?: string;
}

/** Schedule health, derived purely from the latest snapshot's age. */
export interface BackupSchedule {
  intervalSec: number;
  lastBackupAt?: string;
  ageSec?: number;
  due: boolean;
  /** Plain-English ("never backed up", "fresh - 2h ago", "stale - 2d ago"). */
  reason: string;
}

export interface BackupView {
  backups: BackupRecord[];
  latest?: BackupRecord;
  totalEntries: number;
  totalNotes: number;
  keySource: KeySource;
  /** Display path of the backup dir (e.g. "<cwd>/.backups"). */
  backupDir: string;
  schedule: BackupSchedule;
  generatedAt: string;
}
