/**
 * Backup data service (Phase 11) - the ONLY place backups touch Postgres, the
 * filesystem, and the encryption key together. Everything correctness-critical
 * lives here so the rest of the app stays pure:
 *
 *   createBackup   - serialize profile → encrypt with the local app key → write a
 *                    self-contained envelope under /.backups → index it in a row.
 *   listBackups    - the indexed snapshots, newest first (metadata only).
 *   restoreBackup  - ALWAYS takes a pre-restore safety snapshot first, then
 *                    decrypts + verifies the content hash + replaces the profile
 *                    in a single transaction. Tamper/wrong-key fails loudly.
 *   getBackupView  - the /backups page model (records + schedule + key source).
 *   buildPlaintextExport - the one-click portable JSON export (user's own data).
 *
 * Safety spine: the plaintext profile is NEVER written to disk unencrypted by the
 * backup path (only the user's explicit one-click export returns plaintext, over
 * a local download). LIFE_FACT/sensitive entries ARE included in the backup (it
 * must be restorable) but the envelope is encrypted at rest.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { ProfileEntryKind, type Prisma } from "@prisma/client";
import {
  encryptGcm,
  decryptGcm,
  type GcmParts,
} from "@/lib/backup/crypto";
import { loadBackupKey, peekKeySource } from "@/lib/backup/keyfile";
import {
  buildExport,
  contentHash,
  manifestFor,
  needsNewSnapshot,
  type RawProfile,
} from "@/lib/backup/snapshot";
import { processBackupView } from "@/lib/backup/pipeline";
// Re-export the offline preview so pages import both from the service (matches
// the metrics domain convention).
export { previewBackup } from "@/lib/backup/pipeline";
import {
  BACKUP_DIR,
  BACKUP_FORMAT_VERSION,
  type BackupEnvelope,
  type BackupRecord,
  type BackupTrigger,
  type BackupView,
  type ProfileExport,
  type RestoreResult,
} from "@/lib/backup/types";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";

const VALID_KINDS = new Set<string>(Object.values(ProfileEntryKind));

// --- disk helpers ------------------------------------------------------------

function backupRootAbs(): string {
  return path.join(process.cwd(), BACKUP_DIR);
}

function profileDirAbs(scope: AppScope): string {
  return path.join(backupRootAbs(), scope.userId, scope.profileId);
}

function stampFromIso(nowIso: string): string {
  return nowIso.replace(/[-:T.Z]/g, "").slice(0, 14);
}

// --- read the raw profile ----------------------------------------------------

async function readRawProfile(scope: AppScope): Promise<RawProfile> {
  const [user, entries, notes] = await Promise.all([
    db.user.findUnique({ where: { id: scope.userId } }),
    db.profileEntry.findMany({
      where: scopeWhere(scope),
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    }),
    db.profileNote.findMany({
      where: scopeWhere(scope),
      orderBy: { createdAt: "asc" },
    }),
  ]);
  return {
    user: { name: user?.name ?? null, email: user?.email ?? null },
    entries: entries.map((e) => ({
      kind: e.kind,
      data: e.data,
      sourceNote: e.sourceNote,
      sensitive: e.sensitive,
      createdAt: e.createdAt.toISOString(),
    })),
    notes: notes.map((n) => ({
      rawText: n.rawText,
      cleanedText: n.cleanedText,
      source: n.source,
      createdAt: n.createdAt.toISOString(),
    })),
  };
}

/** The full, canonical export (used for the one-click portable JSON download). */
export async function buildPlaintextExport(
  scope: AppScope,
): Promise<ProfileExport> {
  const raw = await readRawProfile(scope);
  return buildExport(raw, new Date().toISOString());
}

// --- create ------------------------------------------------------------------

export async function createBackup(
  scope: AppScope,
  opts?: { trigger?: BackupTrigger; label?: string; force?: boolean },
): Promise<{ record: BackupRecord; deduped: boolean }> {
  const trigger = opts?.trigger ?? "manual";
  const nowIso = new Date().toISOString();

  const raw = await readRawProfile(scope);
  const exp = buildExport(raw, nowIso);
  const hash = contentHash(exp);

  // Dedupe automated snapshots when nothing changed; manual/pre-restore always
  // write (explicit user intent / a guaranteed safety net before a restore).
  const latest = await db.profileBackup.findFirst({
    where: scopeWhere(scope),
    orderBy: { createdAt: "desc" },
  });
  if (
    trigger === "scheduled" &&
    !opts?.force &&
    latest &&
    !needsNewSnapshot(latest.contentHash, exp)
  ) {
    return {
      deduped: true,
      record: toRecord(latest),
    };
  }

  // Encrypt the full export with the local app key.
  const { key } = await loadBackupKey();
  const parts: GcmParts = encryptGcm(JSON.stringify(exp), key);
  const manifest = manifestFor(exp, trigger, nowIso, opts?.label);
  const envelope: BackupEnvelope = {
    formatVersion: BACKUP_FORMAT_VERSION,
    algo: "aes-256-gcm",
    kdf: "app-key",
    iv: parts.iv,
    authTag: parts.authTag,
    ciphertext: parts.ciphertext,
    manifest,
  };

  const fileName = `${stampFromIso(nowIso)}-${hash.slice(0, 8)}.json.enc`;
  const dir = profileDirAbs(scope);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const serialized = JSON.stringify(envelope);
  await fs.writeFile(path.join(dir, fileName), serialized, { mode: 0o600 });

  const row = await db.profileBackup.create({
    data: {
      ...scopeData(scope),
      label: opts?.label ?? null,
      trigger,
      contentHash: hash,
      entryCount: manifest.entryCount,
      noteCount: manifest.noteCount,
      sensitiveCount: manifest.sensitiveCount,
      byteSize: Buffer.byteLength(serialized, "utf8"),
      algo: "aes-256-gcm",
      filePath: path.join(
        BACKUP_DIR,
        scope.userId,
        scope.profileId,
        fileName,
      ),
    },
  });

  return { deduped: false, record: toRecord(row) };
}

// --- list / view -------------------------------------------------------------

type BackupRow = Prisma.ProfileBackupGetPayload<object>;

function toRecord(row: BackupRow): BackupRecord {
  return {
    id: row.id,
    label: row.label,
    trigger: row.trigger as BackupTrigger,
    contentHash: row.contentHash,
    entryCount: row.entryCount,
    noteCount: row.noteCount,
    sensitiveCount: row.sensitiveCount,
    byteSize: row.byteSize,
    fileName: path.basename(row.filePath),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listBackups(scope: AppScope): Promise<BackupRecord[]> {
  const rows = await db.profileBackup.findMany({
    where: scopeWhere(scope),
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function getBackupView(scope: AppScope): Promise<BackupView> {
  const [records, keySource] = await Promise.all([
    listBackups(scope),
    peekKeySource(),
  ]);
  return processBackupView({
    records,
    keySource,
    backupDir: backupRootAbs(),
    nowIso: new Date().toISOString(),
  });
}

// --- restore -----------------------------------------------------------------

/** Decrypt + integrity-check an envelope file into a ProfileExport. */
async function readEnvelope(
  scope: AppScope,
  filePath: string,
): Promise<ProfileExport> {
  const abs = path.join(process.cwd(), filePath);
  const envelope = JSON.parse(await fs.readFile(abs, "utf8")) as BackupEnvelope;
  const { key } = await loadBackupKey();
  const plaintext = decryptGcm(
    { iv: envelope.iv, authTag: envelope.authTag, ciphertext: envelope.ciphertext },
    key,
  );
  const exp = JSON.parse(plaintext) as ProfileExport;
  // Defense in depth: the decrypted content must hash to the manifest's hash.
  if (contentHash(exp) !== envelope.manifest.contentHash) {
    throw new Error("Backup integrity check failed: content hash mismatch.");
  }
  return exp;
}

export async function restoreBackup(
  scope: AppScope,
  backupId: string,
): Promise<RestoreResult> {
  const row = await db.profileBackup.findFirst({
    where: { id: backupId, ...scopeWhere(scope) },
  });
  if (!row) {
    return {
      ok: false,
      restoredEntries: 0,
      restoredNotes: 0,
      contentHash: "",
      reason: "Backup not found.",
    };
  }

  // Decrypt FIRST - if the blob is corrupt/tampered or the key is wrong, fail
  // before we touch the live profile.
  let exp: ProfileExport;
  try {
    exp = await readEnvelope(scope, row.filePath);
  } catch (err) {
    return {
      ok: false,
      restoredEntries: 0,
      restoredNotes: 0,
      contentHash: row.contentHash,
      reason: err instanceof Error ? err.message : "Could not read backup.",
    };
  }

  // Always snapshot the current state before replacing it (forced, no dedupe).
  const safety = await createBackup(scope, {
    trigger: "pre-restore",
    label: `before restoring ${row.id}`,
    force: true,
  });

  const entryData = exp.entries
    .filter((e) => VALID_KINDS.has(e.kind))
    .map((e) => ({
      ...scopeData(scope),
      kind: e.kind as ProfileEntryKind,
      data: e.data as Prisma.InputJsonValue,
      sourceNote: e.sourceNote ?? null,
      sensitive: e.sensitive,
      createdAt: new Date(e.createdAt),
    }));
  const noteData = exp.notes.map((n) => ({
    ...scopeData(scope),
    rawText: n.rawText,
    cleanedText: n.cleanedText ?? null,
    source: n.source,
    createdAt: new Date(n.createdAt),
  }));

  // Replace the profile atomically: out with the current rows, in with the
  // snapshot's. The pre-restore safety backup above is the undo path.
  await db.$transaction([
    db.profileEntry.deleteMany({ where: scopeWhere(scope) }),
    db.profileNote.deleteMany({ where: scopeWhere(scope) }),
    db.profileEntry.createMany({ data: entryData }),
    db.profileNote.createMany({ data: noteData }),
  ]);

  return {
    ok: true,
    restoredEntries: entryData.length,
    restoredNotes: noteData.length,
    contentHash: row.contentHash,
    safetyBackupId: safety.record.id,
  };
}
