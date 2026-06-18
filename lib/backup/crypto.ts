/**
 * Backup crypto (Phase 11, Hardening §E + §D: the master profile is the most
 * irreplaceable data in the app and may contain LIFE_FACT entries, so snapshots
 * are encrypted at rest). Thin, auditable wrapper over Node's crypto:
 *
 *   - AES-256-GCM (authenticated): tampering with a stored blob fails decryption
 *     loudly instead of silently returning garbage.
 *   - 12-byte random IV per snapshot, 16-byte auth tag.
 *   - scrypt KDF for passphrase-based PORTABLE exports (kdf="scrypt"); the
 *     automated path uses a 32-byte local app key directly (kdf="app-key").
 *
 * This module holds NO key material and touches NO disk or DB - callers pass the
 * key in. It is deterministic given its inputs except for the random IV/salt,
 * which is exactly what you want: encrypt→decrypt round-trips regardless.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

export interface GcmParts {
  iv: string; // base64
  authTag: string; // base64
  ciphertext: string; // base64
}

/** sha256 hex of a string - used for content hashing (dedupe + integrity). */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/** A fresh 32-byte key (base64) for the automated app-key path. */
export function generateKeyBase64(): string {
  return randomBytes(KEY_BYTES).toString("base64");
}

/** Fresh scrypt salt (base64) for a passphrase-derived key. */
export function generateSaltBase64(): string {
  return randomBytes(SALT_BYTES).toString("base64");
}

/**
 * Coerce a configured key string into a 32-byte Buffer. Accepts base64 or hex.
 * Throws if it doesn't decode to exactly 32 bytes - a misconfigured key must
 * fail loudly, never silently truncate/pad.
 */
export function keyFromString(raw: string): Buffer {
  const tryDecode = (enc: BufferEncoding): Buffer | null => {
    try {
      const b = Buffer.from(raw, enc);
      return b.length === KEY_BYTES ? b : null;
    } catch {
      return null;
    }
  };
  const b64 = tryDecode("base64");
  if (b64) return b64;
  const hex = tryDecode("hex");
  if (hex) return hex;
  throw new Error(
    `Backup key must decode to ${KEY_BYTES} bytes (base64 or hex); got ${raw.length} chars.`,
  );
}

/** Derive a 32-byte key from a passphrase + salt (scrypt). */
export function deriveScryptKey(passphrase: string, saltBase64: string): Buffer {
  const salt = Buffer.from(saltBase64, "base64");
  return scryptSync(passphrase, salt, KEY_BYTES);
}

/** Encrypt UTF-8 plaintext with AES-256-GCM. Returns base64 iv/tag/ciphertext. */
export function encryptGcm(plaintext: string, key: Buffer): GcmParts {
  if (key.length !== KEY_BYTES) {
    throw new Error(`Key must be ${KEY_BYTES} bytes; got ${key.length}.`);
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

/**
 * Decrypt AES-256-GCM. THROWS if the auth tag doesn't verify (tampered blob or
 * wrong key) - never returns partial/garbage plaintext.
 */
export function decryptGcm(parts: GcmParts, key: Buffer): string {
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(parts.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parts.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parts.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
