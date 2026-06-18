/**
 * Canonical identity for a job posting - stable key used for exact-dup collapse
 * and as the DB unique constraint. Normalizes noisy real-world company/title/
 * location strings so trivial formatting differences (punctuation, legal suffix,
 * extra whitespace) hash to the same key.
 *
 * Pure: no LLM, no network, no DB. Node crypto only.
 */

import { createHash } from "crypto";

/** Legal-entity suffixes that add no identity signal. */
const LEGAL_SUFFIXES =
  /[\s,.]+(inc|llc|ltd|corp|co|gmbh|plc|ag|bv|nv|sa|sas|srl|pty|aps)\.?$/i;

/** Punctuation-and-symbol noise that survives after lowercasing. */
const PUNCT_NOISE = /[^\w\s]/g;

/**
 * Normalize a company name to a canonical, comparable form.
 * Steps: lowercase → strip trailing legal suffix → remove punctuation →
 * collapse whitespace → trim.
 */
export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, "")
    .replace(PUNCT_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a job title to a canonical, comparable form.
 * Steps: lowercase → remove punctuation → collapse whitespace → trim.
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(PUNCT_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a location string. Keeps letters/digits/spaces only so "New York,
 * NY" and "New York NY" hash identically.
 */
function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Stable, deterministic SHA-1 of the normalized (company, title, location)
 * triple. Returns the first 16 hex chars - collision-free for realistic job
 * volumes (<100 k records). Same real-world job, different formatting → same
 * hash. Different job → different hash with overwhelming probability.
 */
export function identityHash(
  company: string,
  title: string,
  location?: string,
): string {
  const parts = [
    normalizeCompany(company),
    normalizeTitle(title),
    location ? normalizeLocation(location) : "",
  ];
  return createHash("sha1").update(parts.join("\x00")).digest("hex").slice(0, 16);
}
