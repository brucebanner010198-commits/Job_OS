/**
 * Dedupe + ghost + scam filter - the screen() orchestrator (plan §8a).
 *
 * Pipeline:
 *   1. Exact-dup collapse   - identityHash(company, title, location)
 *   2. Near-dup collapse    - MinHash/LSH band key + Jaccard confirmation
 *   3. Ghost assessment     - rules-first on the deduped survivors
 *   4. Scam assessment      - rules-first on the deduped survivors
 *
 * Pure: no LLM, no network, no DB, no Math.random(). Fully deterministic.
 * The LLM "borderline" pass is a documented seam (plan §8a); this module
 * exposes NEARDUP_THRESHOLD so callers can tune it.
 */

import type { RawJob, ScreenedJob, ScreenResult, ExcludeReason } from "@/lib/jobs/types";
import { identityHash } from "./identity";
import { shingles, minhashSignature, bandKey, allBandKeys, estimatedJaccard } from "./minhash";
import { assessGhost } from "./ghost";
import { assessScam } from "./scam";

/**
 * Jaccard similarity above which two near-dup survivors are collapsed.
 * 0.50 means "50% of 3-word shingles overlap" - catches copy-pasted JDs (the
 * common case of the same posting scraped from 5 sources) with minor formatting
 * differences while leaving genuinely different roles alone. True Jaccard for
 * the same posting with minor edits is typically 0.7–0.95; for different roles
 * it is typically < 0.10.
 */
export const NEARDUP_THRESHOLD = 0.50;

// Re-export thresholds so callers and tests don't need to import sub-modules
export { GHOST_THRESHOLD } from "./ghost";
export { SCAM_THRESHOLD } from "./scam";

/**
 * Compute the MinHash fingerprint (first-band LSH key) for a raw JD.
 * Short descriptions (<10 words) get a synthetic unique key so they never
 * accidentally share a band bucket.
 */
function computeFingerprint(description: string, fallbackKey: string): string {
  const s = shingles(description);
  if (s.size < 3) return `short:${fallbackKey}`;
  const sig = minhashSignature(s);
  return bandKey(sig);
}

/**
 * Choose the "canonical" job when two jobs share an identity or are near-dups.
 * Prefer the job with the longer description; break ties by the job that appears
 * first in the input array (stable sort).
 */
function pickCanonical(a: RawJob, b: RawJob): "a" | "b" {
  const lenA = (a.description ?? "").length;
  const lenB = (b.description ?? "").length;
  return lenA >= lenB ? "a" : "b";
}

/**
 * Count non-undefined "quality" fields to prefer the richer record.
 */
function fieldCount(raw: RawJob): number {
  return [raw.url, raw.salaryMin, raw.salaryMax, raw.postedAt, raw.atsType, raw.remote]
    .filter((v) => v !== undefined)
    .length;
}

/**
 * Select the better of two raw jobs (more fields wins; description length is
 * the tiebreaker).
 */
function betterOf(a: RawJob, b: RawJob): "a" | "b" {
  const fa = fieldCount(a);
  const fb = fieldCount(b);
  if (fa !== fb) return fa > fb ? "a" : "b";
  return pickCanonical(a, b);
}

/**
 * screen() - the main filter entry point.
 *
 * @param jobs  Raw postings from all sources (may include duplicates, ghosts, scams).
 * @returns     ScreenResult with kept (survivors), dropped (audit trail), and stats.
 */
export function screen(jobs: RawJob[]): ScreenResult {
  if (jobs.length === 0) {
    return { kept: [], dropped: [], stats: { total: 0, duplicates: 0, ghosts: 0, scams: 0, kept: 0 } };
  }

  // -- Step 1: Attach identity hash and fingerprint to every job ----------
  const enriched: Array<{
    raw: RawJob;
    identityHash: string;
    fingerprint: string;
    sig: number[]; // kept for Jaccard; not in the public ScreenedJob shape
  }> = jobs.map((raw, i) => {
    const idHash = identityHash(raw.company, raw.title, raw.location);
    const fp = computeFingerprint(raw.description, `${idHash}:${i}`);
    const s = shingles(raw.description ?? "");
    const sig = s.size >= 3 ? minhashSignature(s) : [];
    return { raw, identityHash: idHash, fingerprint: fp, sig };
  });

  // -- Step 2: Exact-dup collapse -----------------------------------------
  // Group by identityHash; the winner is the richest record.
  const exactGroups = new Map<string, typeof enriched>();
  for (const item of enriched) {
    const group = exactGroups.get(item.identityHash) ?? [];
    group.push(item);
    exactGroups.set(item.identityHash, group);
  }

  // For each group, pick the canonical; mark the rest as exact duplicates.
  const exactDupDropped: ScreenedJob[] = [];
  const exactSurvivors: typeof enriched = [];

  for (const group of exactGroups.values()) {
    if (group.length === 1) {
      exactSurvivors.push(group[0]);
      continue;
    }
    // Find the richest record
    let canonicalIdx = 0;
    for (let i = 1; i < group.length; i++) {
      if (betterOf(group[canonicalIdx].raw, group[i].raw) === "b") canonicalIdx = i;
    }
    const canonical = group[canonicalIdx];
    exactSurvivors.push(canonical);

    for (let i = 0; i < group.length; i++) {
      if (i === canonicalIdx) continue;
      exactDupDropped.push({
        raw: group[i].raw,
        identityHash: group[i].identityHash,
        fingerprint: group[i].fingerprint,
        ghost: { score: 0, reasons: [], flagged: false },
        scam: { score: 0, reasons: [], flagged: false },
        excluded: true,
        excludeReason: "duplicate" as ExcludeReason,
        canonicalOf: canonical.identityHash,
      });
    }
  }

  // -- Step 3: Near-dup collapse ------------------------------------------
  // For each survivor, compute ALL band keys and add it to every matching
  // bucket. Any two documents that share a bucket get Jaccard-checked and are
  // collapsed if estimatedJaccard >= NEARDUP_THRESHOLD. Union-Find handles
  // transitive chains. Using all bands (not just band-0) gives ~99% recall for
  // Jaccard ≥ 0.85 with 8 bands of 8 rows.

  const bandBuckets = new Map<string, number[]>(); // band-prefixed key → indices into exactSurvivors
  for (let i = 0; i < exactSurvivors.length; i++) {
    const sig = exactSurvivors[i].sig;
    if (sig.length === 0) continue;
    const keys = allBandKeys(sig);
    for (const key of keys) {
      const bucket = bandBuckets.get(key) ?? [];
      bucket.push(i);
      bandBuckets.set(key, bucket);
    }
  }

  // Union-Find helpers (path-compressed)
  const parent = exactSurvivors.map((_, i) => i);
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]; // path halving
      x = parent[x];
    }
    return x;
  }
  function union(x: number, y: number): void {
    parent[find(x)] = find(y);
  }

  for (const indices of bandBuckets.values()) {
    if (indices.length < 2) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = exactSurvivors[indices[i]];
        const b = exactSurvivors[indices[j]];
        if (a.sig.length === 0 || b.sig.length === 0) continue;
        const j_hat = estimatedJaccard(a.sig, b.sig);
        if (j_hat >= NEARDUP_THRESHOLD) {
          union(indices[i], indices[j]);
        }
      }
    }
  }

  // For each near-dup component, pick the canonical (richest)
  const nearDupGroups = new Map<number, number[]>(); // root → member indices
  for (let i = 0; i < exactSurvivors.length; i++) {
    const root = find(i);
    const group = nearDupGroups.get(root) ?? [];
    group.push(i);
    nearDupGroups.set(root, group);
  }

  const nearDupDropped: ScreenedJob[] = [];
  const nearDupSurvivors: typeof exactSurvivors = [];

  for (const group of nearDupGroups.values()) {
    if (group.length === 1) {
      nearDupSurvivors.push(exactSurvivors[group[0]]);
      continue;
    }
    // Canonical = richest in the group
    let canonicalIdx = group[0];
    for (let i = 1; i < group.length; i++) {
      if (betterOf(exactSurvivors[canonicalIdx].raw, exactSurvivors[group[i]].raw) === "b") {
        canonicalIdx = group[i];
      }
    }
    nearDupSurvivors.push(exactSurvivors[canonicalIdx]);

    for (const idx of group) {
      if (idx === canonicalIdx) continue;
      const item = exactSurvivors[idx];
      nearDupDropped.push({
        raw: item.raw,
        identityHash: item.identityHash,
        fingerprint: item.fingerprint,
        ghost: { score: 0, reasons: [], flagged: false },
        scam: { score: 0, reasons: [], flagged: false },
        excluded: true,
        excludeReason: "duplicate" as ExcludeReason,
        canonicalOf: exactSurvivors[canonicalIdx].identityHash,
      });
    }
  }

  // -- Step 4: Ghost + scam assessment on deduped survivors --------------
  const finalKept: ScreenedJob[] = [];
  const riskDropped: ScreenedJob[] = [];

  for (const item of nearDupSurvivors) {
    const ghost = assessGhost(item.raw);
    const scam = assessScam(item.raw);

    let excluded = false;
    let excludeReason: ExcludeReason | undefined;

    // Scam takes precedence over ghost
    if (scam.flagged) {
      excluded = true;
      excludeReason = "scam";
    } else if (ghost.flagged) {
      excluded = true;
      excludeReason = "ghost";
    }

    const screened: ScreenedJob = {
      raw: item.raw,
      identityHash: item.identityHash,
      fingerprint: item.fingerprint,
      ghost,
      scam,
      excluded,
      excludeReason,
    };

    if (excluded) {
      riskDropped.push(screened);
    } else {
      finalKept.push(screened);
    }
  }

  // -- Step 5: Assemble ScreenResult -------------------------------------
  const dropped = [...exactDupDropped, ...nearDupDropped, ...riskDropped];

  const duplicates = exactDupDropped.length + nearDupDropped.length;
  const ghosts = riskDropped.filter((j) => j.excludeReason === "ghost").length;
  const scams = riskDropped.filter((j) => j.excludeReason === "scam").length;

  return {
    kept: finalKept,
    dropped,
    stats: {
      total: jobs.length,
      duplicates,
      ghosts,
      scams,
      kept: finalKept.length,
    },
  };
}
