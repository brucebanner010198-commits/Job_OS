/**
 * Near-duplicate detection over job-description text via MinHash + LSH.
 *
 * Fully deterministic - no Math.random(). Hash-function coefficients (a_i, b_i)
 * are derived from the permutation index using a pair of fixed seeds, so the
 * same text always produces the same signature and the same band key.
 *
 * Plan §8a: "MinHash/LSH on JD text to collapse the ~5 duplicate records per
 * job." This module computes the signature; lib/jobs/filter/index.ts runs the
 * collapse pass.
 */

/** A large Mersenne prime. Arithmetic is done with BigInt to avoid overflow. */
const PRIME = 4_294_967_291; // 2^32 - 5
const PRIME_BIG = BigInt(PRIME);

/** Universe size - we fold shingle hashes into [0, UNIVERSE). */
const UNIVERSE = PRIME;

/**
 * Derive the i-th (a, b) coefficient pair deterministically from the index.
 * Uses two independent linear congruential generators seeded with fixed magic
 * constants so the family is fixed across runs and environments.
 */
function coefficients(i: number): [number, number] {
  // LCG-1 for `a`: multiplier 1664525, addend 1013904223 (Knuth/Numerical Recipes)
  const a = (Math.imul(i + 1, 1_664_525) + 1_013_904_223) >>> 0;
  // LCG-2 for `b`: different multiplier so a and b are uncorrelated
  const b = (Math.imul(i + 1, 22_695_477) + 1) >>> 0;
  // Ensure a is odd and in [1, PRIME-1], b in [0, PRIME-1]
  return [(a % (PRIME - 1)) + 1, b % PRIME];
}

/**
 * FNV-1a 32-bit hash of a string - fast, deterministic, no deps.
 * Returns an unsigned 32-bit integer.
 */
function fnv1a32(s: string): number {
  let h = 2_166_136_261; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return h;
}

/**
 * Produce k-word shingles from text.
 *
 * @param text  Raw JD text (any case, any punctuation).
 * @param k     Shingle width in words (default 3). k=3 balances precision vs
 *              recall for near-dups that reword sentences.
 * @returns     Set of shingle strings like "senior software engineer".
 */
export function shingles(text: string, k = 3): Set<string> {
  // Normalize: lowercase, collapse non-alpha-numeric runs to single space
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  const out = new Set<string>();
  for (let i = 0; i <= words.length - k; i++) {
    out.add(words.slice(i, i + k).join(" "));
  }
  return out;
}

/**
 * Compute the MinHash signature for a shingle set.
 *
 * Each of the `numHashes` hash functions maps every shingle h → (a*h + b) mod p,
 * and the minimum over all shingles is the MinHash value for that function.
 *
 * @param shingleSet  Output of `shingles()`.
 * @param numHashes   Signature length (default 64). Higher = more accurate
 *                    Jaccard estimate; 64 gives ±0.125 at 95% confidence.
 * @returns           Array of `numHashes` integers - the MinHash signature.
 */
export function minhashSignature(
  shingleSet: Set<string>,
  numHashes = 64,
): number[] {
  if (shingleSet.size === 0) return new Array(numHashes).fill(0);

  // Pre-hash each shingle once to an integer
  const hashes = Array.from(shingleSet).map(fnv1a32);

  const sig: number[] = new Array(numHashes).fill(UNIVERSE);

  // Pre-convert hashes to BigInt once (reused across all numHashes iterations)
  const bigHashes = hashes.map((h) => BigInt(h >>> 0));

  for (let i = 0; i < numHashes; i++) {
    const [a, b] = coefficients(i);
    const aBig = BigInt(a);
    const bBig = BigInt(b);
    let min = UNIVERSE;
    for (const hBig of bigHashes) {
      // Exact (a * h + b) mod p - BigInt avoids the 32-bit overflow that
      // causes Math.imul to silently truncate large products and skew Jaccard.
      const v = Number((aBig * hBig + bBig) % PRIME_BIG);
      if (v < min) min = v;
    }
    sig[i] = min;
  }

  return sig;
}

/**
 * LSH band key - first-band projection of the MinHash signature.
 * Stored in `ScreenedJob.fingerprint` as a stable coarse bucket identifier.
 *
 * @param signature  MinHash signature from `minhashSignature`.
 * @param bands      Number of bands (default 8).
 * @returns          A deterministic hex string bucket key for band 0.
 */
export function bandKey(signature: number[], bands = 8): string {
  const rows = Math.floor(signature.length / bands);
  const band0 = signature.slice(0, rows);
  return createHash("sha1")
    .update(band0.join(","))
    .digest("hex")
    .slice(0, 12);
}

/**
 * All band keys for a MinHash signature - used by the near-dup collapse loop.
 *
 * Two documents share at least one bucket (and therefore get Jaccard-checked)
 * if they collide in ANY of the `bands` projections. With 8 bands of 8 rows
 * and Jaccard=0.85, the collision probability is 1-(1-0.85^8)^8 ≈ 0.99.
 *
 * @returns  Array of `bands` deterministic hex strings, one per band.
 */
export function allBandKeys(signature: number[], bands = 8): string[] {
  const rows = Math.floor(signature.length / bands);
  const keys: string[] = [];
  for (let b = 0; b < bands; b++) {
    const slice = signature.slice(b * rows, (b + 1) * rows);
    keys.push(
      createHash("sha1")
        .update(`${b}:${slice.join(",")}`)
        .digest("hex")
        .slice(0, 12),
    );
  }
  return keys;
}

/**
 * Estimated Jaccard similarity between two MinHash signatures.
 * Returns the fraction of positions where sig[i] === sigB[i], in [0, 1].
 * By the MinHash property, E[matches/n] = J(A, B).
 */
export function estimatedJaccard(sigA: number[], sigB: number[]): number {
  if (sigA.length === 0 || sigB.length === 0) return 0;
  const len = Math.min(sigA.length, sigB.length);
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (sigA[i] === sigB[i]) matches++;
  }
  return matches / len;
}

// Node crypto is fine in this file (used by bandKey above)
import { createHash } from "crypto";
