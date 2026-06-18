/**
 * Self-test for Phase 11 (encrypted backups + export/restore). THIS IS THE
 * test:backup gate. Pure, offline, deterministic - a constant NOW is injected and
 * no DB/fs is touched. Four parts:
 *   A. Snapshot brain - canonical export, hash determinism + order/time
 *      independence, dedupe, schedule status, age formatting.
 *   B. Crypto - AES-256-GCM round-trip, tamper/wrong-key REJECTION, key parsing,
 *      scrypt determinism.
 *   C. Envelope - end-to-end encrypt → manifest → decrypt → integrity check, and
 *      a tampered envelope is caught by the content-hash guard.
 *   D. Pipeline - BackupView assembly (latest/totals/schedule) + offline preview.
 * Run: npx tsx scripts/test-backup.ts
 */
import {
  buildExport,
  contentHash,
  manifestFor,
  needsNewSnapshot,
  scheduleStatus,
  humanAge,
  type RawProfile,
} from "@/lib/backup/snapshot";
import {
  sha256Hex,
  generateKeyBase64,
  generateSaltBase64,
  keyFromString,
  deriveScryptKey,
  encryptGcm,
  decryptGcm,
} from "@/lib/backup/crypto";
import { processBackupView, previewBackup } from "@/lib/backup/pipeline";
import { fixtureProfile, FIXTURE_NOW, EXPECTED } from "@/lib/backup/fixtures";
import { BACKUP_INTERVAL_SEC, type ProfileExport } from "@/lib/backup/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

// ===========================================================================
// A. SNAPSHOT BRAIN
// ===========================================================================
console.log("\nbackup - snapshot brain (canonical export + content hash):");

const exp = buildExport(fixtureProfile, FIXTURE_NOW);
check(`entryCount = ${EXPECTED.entryCount}`, exp.entries.length === EXPECTED.entryCount);
check(`noteCount = ${EXPECTED.noteCount}`, exp.notes.length === EXPECTED.noteCount);
check(
  `sensitiveCount = ${EXPECTED.sensitiveCount}`,
  exp.entries.filter((e) => e.sensitive).length === EXPECTED.sensitiveCount,
);

const h1 = contentHash(exp);
check("content hash is deterministic (same input → same hash)", contentHash(buildExport(fixtureProfile, FIXTURE_NOW)) === h1);

// Order independence: shuffle the entry/note input → identical hash.
const shuffled: RawProfile = {
  user: fixtureProfile.user,
  entries: [...fixtureProfile.entries].reverse(),
  notes: [...fixtureProfile.notes],
};
check("content hash ignores input order", contentHash(buildExport(shuffled, FIXTURE_NOW)) === h1);

// Time independence: a different exportedAt must NOT change the content hash.
check("content hash ignores exportedAt", contentHash(buildExport(fixtureProfile, "2030-01-01T00:00:00.000Z")) === h1);

// Change sensitivity: mutate one entry → hash changes.
const mutated: RawProfile = {
  ...fixtureProfile,
  entries: [
    { ...fixtureProfile.entries[0], data: { changed: true } },
    ...fixtureProfile.entries.slice(1),
  ],
};
check("content hash changes when content changes", contentHash(buildExport(mutated, FIXTURE_NOW)) !== h1);

check("needsNewSnapshot=false when hash matches", needsNewSnapshot(h1, exp) === false);
check("needsNewSnapshot=true when hash differs", needsNewSnapshot("deadbeef", exp) === true);

const manifest = manifestFor(exp, "manual", FIXTURE_NOW, "first run");
check("manifest carries the content hash", manifest.contentHash === h1);
check("manifest counts match", manifest.entryCount === 3 && manifest.noteCount === 1 && manifest.sensitiveCount === 1);
check("manifest keeps the label + trigger", manifest.label === "first run" && manifest.trigger === "manual");

console.log("\nbackup - schedule status (derived purely from latest age):");
const never = scheduleStatus(undefined, FIXTURE_NOW, BACKUP_INTERVAL_SEC);
check("never backed up ⇒ due", never.due && /never/.test(never.reason));
const fresh = scheduleStatus("2026-06-17T10:00:00.000Z", FIXTURE_NOW, BACKUP_INTERVAL_SEC);
check("2h old ⇒ not due (fresh)", !fresh.due && /fresh/.test(fresh.reason));
const stale = scheduleStatus("2026-06-15T10:00:00.000Z", FIXTURE_NOW, BACKUP_INTERVAL_SEC);
check("2d old ⇒ due (stale)", stale.due && /stale/.test(stale.reason));
check("humanAge formats m/h/d", humanAge(30) === "30s" && humanAge(3600) === "1h" && humanAge(172800) === "2d");

// ===========================================================================
// B. CRYPTO
// ===========================================================================
console.log("\nbackup - crypto (AES-256-GCM round-trip + tamper rejection):");

check("sha256Hex is stable", sha256Hex("job-os") === sha256Hex("job-os"));

const key = keyFromString(generateKeyBase64());
const secret = JSON.stringify({ life: "Primary caregiver on Mondays", n: 42 });
const parts = encryptGcm(secret, key);
check("decrypt(encrypt(x)) === x", decryptGcm(parts, key) === secret);
check("ciphertext is not the plaintext", !Buffer.from(parts.ciphertext, "base64").toString("utf8").includes("caregiver"));

// Wrong key must throw (GCM auth tag fails).
let wrongKeyThrew = false;
try {
  decryptGcm(parts, keyFromString(generateKeyBase64()));
} catch {
  wrongKeyThrew = true;
}
check("wrong key REJECTS (throws, no garbage)", wrongKeyThrew);

// Tampered ciphertext must throw.
const tamperedBytes = Buffer.from(parts.ciphertext, "base64");
tamperedBytes[0] = tamperedBytes[0] ^ 0xff;
let tamperThrew = false;
try {
  decryptGcm({ ...parts, ciphertext: tamperedBytes.toString("base64") }, key);
} catch {
  tamperThrew = true;
}
check("tampered ciphertext REJECTS (auth tag)", tamperThrew);

check("keyFromString accepts base64 32B", keyFromString(generateKeyBase64()).length === 32);
check("keyFromString accepts hex 32B", keyFromString(Buffer.alloc(32, 7).toString("hex")).length === 32);
let badKeyThrew = false;
try {
  keyFromString("too-short");
} catch {
  badKeyThrew = true;
}
check("keyFromString rejects wrong length", badKeyThrew);

const salt = generateSaltBase64();
check("scrypt key is deterministic for (passphrase, salt)", deriveScryptKey("hunter2", salt).equals(deriveScryptKey("hunter2", salt)));
check("scrypt key differs for a different passphrase", !deriveScryptKey("hunter2", salt).equals(deriveScryptKey("hunter3", salt)));

// passphrase round-trip (the portable-export path)
const pKey = deriveScryptKey("correct horse", salt);
const pParts = encryptGcm(secret, pKey);
check("passphrase round-trip works", decryptGcm(pParts, deriveScryptKey("correct horse", salt)) === secret);

// ===========================================================================
// C. ENVELOPE (encrypt → manifest → decrypt → integrity)
// ===========================================================================
console.log("\nbackup - envelope end-to-end + integrity guard:");

const plaintext = JSON.stringify(exp);
const encParts = encryptGcm(plaintext, key);
const roundTripped = JSON.parse(decryptGcm(encParts, key)) as ProfileExport;
check("envelope decrypts to the same export", contentHash(roundTripped) === manifest.contentHash);
check("decrypted export keeps the sensitive entry", roundTripped.entries.some((e) => e.sensitive));

// Integrity guard: if the decrypted content doesn't match the manifest hash, reject.
const forged = { ...roundTripped, entries: roundTripped.entries.slice(0, 1) };
check("content-hash guard catches a swapped payload", contentHash(forged) !== manifest.contentHash);

// ===========================================================================
// D. PIPELINE (the /backups view + offline preview)
// ===========================================================================
console.log("\nbackup - view assembly + offline preview:");

const view = processBackupView({
  records: [
    { id: "b1", trigger: "manual", contentHash: "a", entryCount: 2, noteCount: 0, sensitiveCount: 0, byteSize: 100, fileName: "old.enc", createdAt: "2026-06-16T09:00:00.000Z" },
    { id: "b2", trigger: "scheduled", contentHash: "b", entryCount: 3, noteCount: 1, sensitiveCount: 1, byteSize: 200, fileName: "new.enc", createdAt: "2026-06-17T09:00:00.000Z" },
  ],
  keySource: "app-key",
  backupDir: "/tmp/.backups",
  nowIso: "2026-06-17T11:00:00.000Z",
});
check("view sorts newest-first", view.backups[0].id === "b2");
check("latest is the newest", view.latest?.id === "b2");
check("totals come from latest", view.totalEntries === 3 && view.totalNotes === 1);
check("schedule fresh (2h old, <24h)", !view.schedule.due);
check("key source surfaced", view.keySource === "app-key");

const preview = previewBackup();
check("preview renders 2 sample backups", preview.backups.length === 2);
check("preview reports a schedule reason", preview.schedule.reason.trim().length > 0);
check("preview latest has the sensitive count", (preview.latest?.sensitiveCount ?? 0) >= 1);

// ===========================================================================
console.log(`\nbackup ${passed}/${passed + failed}\n`);
if (failed > 0) process.exit(1);
