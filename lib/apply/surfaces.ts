/**
 * Surface classification for the apply autonomy router (Phase 5, Hardening §A).
 *
 * `TOLERANT_SURFACES` are low-friction sources eligible for the AUTONOMOUS lane.
 * `BLOCKED_SURFACES` always force MANUAL/SKIP regardless of any other signal.
 * Everything else is "standard" and defaults to ASSISTED.
 *
 * Open risk (plan §A): these sets will drift as platforms update anti-bot
 * defences and apply-flow complexity. They should be treated as config
 * (future: DB-backed feature-flag or env-controlled allowlist) and audited
 * whenever a platform ships a major apply-flow change. When in doubt, remove
 * a surface from TOLERANT rather than leave a broken autonomous path in place.
 */

/** Lowercase surface keys eligible for the AUTONOMOUS lane. */
export const TOLERANT_SURFACES: ReadonlySet<string> = new Set([
  "dice",
  "wellfound",
  "email",
  "mailto",
  "company-simple",
]);

/**
 * Surface keys that always force MANUAL/SKIP.
 * LinkedIn and Workday have complex apply flows, anti-bot defences,
 * and/or account-state requirements that make autonomous submission unsafe.
 */
export const BLOCKED_SURFACES: ReadonlySet<string> = new Set([
  "linkedin",
  "workday",
]);

/**
 * Classify a surface key into one of three tiers used by the router.
 *
 * Normalises to lowercase and trims whitespace before lookup - callers need
 * not pre-clean. Unknown surfaces always fall back to "standard" (→ ASSISTED),
 * which is the safe direction.
 *
 * Config note: `TOLERANT_SURFACES` and `BLOCKED_SURFACES` are hard-coded here
 * for Phase 5 but should become config-driven as anti-bot defences change
 * (noted as an open risk in the Phase-5 plan).
 */
export function classifySurface(
  surface: string,
): "tolerant" | "blocked" | "standard" {
  const key = surface.toLowerCase().trim();
  if (BLOCKED_SURFACES.has(key)) return "blocked";
  if (TOLERANT_SURFACES.has(key)) return "tolerant";
  return "standard";
}
