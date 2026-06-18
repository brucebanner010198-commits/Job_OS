/**
 * Warm-path RANKING brain (Phase 7, plan §9 + Module 9). Pure + deterministic:
 * no DB, no network, no LLM, no system-clock read. Given a target company and
 * the user's network, it returns every genuine path-in, strongest first, and
 * runs the low-volume etiquette gate (`reachOut`).
 *
 * Safety spine (Hardening §B/§F):
 *   - TRUTHFUL / EXTRACTIVE: a path is only ever asserted from a REAL matched
 *     connection (domain or company-name match). When no genuine connection
 *     exists the ranker returns a NONE path that recommends applying cold -
 *     it NEVER fabricates a tie to manufacture a warm path.
 *   - LOW-VOLUME / ETIQUETTE: `reachOut` is false (apply cold) below
 *     MIN_STRENGTH_TO_REACH_OUT, so a tenuous tie does not justify the ask.
 *   - DRAFT-FIRST / HUMAN-IN-THE-LOOP: this brain only PROPOSES + ranks; it
 *     never contacts anyone.
 */

import type {
  Connection,
  ConnectionRelationship,
  IntroChannel,
  PathKind,
  WarmPath,
  WarmTarget,
} from "@/lib/warm/types";
import { MIN_STRENGTH_TO_REACH_OUT } from "@/lib/warm/types";

// --- Matching -------------------------------------------------------------

/**
 * A connection works AT the target iff its company domain matches (case-folded)
 * OR its company name matches case-insensitively. Empty fields never match.
 */
function worksAtTarget(conn: Connection, target: WarmTarget): boolean {
  const targetDomain = target.companyDomain?.trim().toLowerCase();
  const connDomain = conn.companyDomain?.trim().toLowerCase();
  if (targetDomain && connDomain && targetDomain === connDomain) return true;

  const targetName = target.company?.trim().toLowerCase();
  const connName = conn.company?.trim().toLowerCase();
  if (targetName && connName && targetName === connName) return true;

  return false;
}

// --- Strength + pathKind --------------------------------------------------

/** Map a real (relationship, degree) onto its path kind + base strength. */
function classify(conn: Connection): { pathKind: PathKind; base: number } {
  const { relationship, degree } = conn;

  if (relationship === "COLLEAGUE" && degree === 1) {
    return { pathKind: "CURRENT_COLLEAGUE", base: 0.95 };
  }
  if (relationship === "FRIEND" && degree === 1) {
    return { pathKind: "FRIEND", base: 0.8 };
  }
  if (relationship === "ALUMNI") {
    return { pathKind: "ALUMNI", base: 0.7 };
  }
  if (relationship === "MUTUAL") {
    return { pathKind: "MUTUAL_CONNECTION", base: 0.55 };
  }
  if (relationship === "COMMUNITY") {
    return { pathKind: "COMMUNITY", base: 0.5 };
  }
  // OTHER / fallback: a non-1st-degree colleague is a FORMER colleague who is
  // now at the target; anything else degrades to a COMMUNITY-strength tie.
  if (relationship === "COLLEAGUE") {
    return { pathKind: "FORMER_COLLEAGUE", base: 0.75 };
  }
  return { pathKind: "COMMUNITY", base: 0.5 };
}

/** Apply the degree penalty, floor at 0.1, clamp 0..1, round to 2 decimals. */
function scoreStrength(base: number, degree: 1 | 2 | 3): number {
  const penalty = degree === 3 ? 0.15 : degree === 2 ? 0.05 : 0;
  let s = base - penalty;
  if (s < 0.1) s = 0.1; // never let the penalty sink a real path below 0.1
  if (s > 1) s = 1;
  if (s < 0) s = 0;
  return Math.round(s * 100) / 100;
}

// --- Plain-language wording ------------------------------------------------

function degreeWord(degree: 1 | 2 | 3): string {
  return degree === 1 ? "1st" : degree === 2 ? "2nd" : "3rd";
}

function relationshipNoun(rel: ConnectionRelationship): string {
  switch (rel) {
    case "COLLEAGUE":
      return "colleague";
    case "ALUMNI":
      return "alum";
    case "MUTUAL":
      return "mutual connection";
    case "COMMUNITY":
      return "community contact";
    case "FRIEND":
      return "friend";
    default:
      return "contact";
  }
}

function kindLabel(pathKind: PathKind): string {
  switch (pathKind) {
    case "CURRENT_COLLEAGUE":
      return "current-colleague";
    case "FORMER_COLLEAGUE":
      return "former-colleague";
    case "ALUMNI":
      return "alumni";
    case "MUTUAL_CONNECTION":
      return "mutual-connection";
    case "COMMUNITY":
      return "community";
    case "FRIEND":
      return "friend";
    default:
      return "none";
  }
}

/** Why this kind of tie is a genuine path - never invents a fact. */
function kindBlurb(pathKind: PathKind, company: string): string {
  switch (pathKind) {
    case "CURRENT_COLLEAGUE":
      return `You worked together and they're at ${company} now - they can refer you from the inside.`;
    case "FORMER_COLLEAGUE":
      return `You worked together before and they're now at ${company} - a strong basis for a referral.`;
    case "ALUMNI":
      return `You share a school/program and they're at ${company} - a natural reason to reach out.`;
    case "MUTUAL_CONNECTION":
      return `A shared contact links you to ${company} - ask for a warm introduction.`;
    case "COMMUNITY":
      return `You're tied through a community/project and they're at ${company}.`;
    case "FRIEND":
      return `A personal friend at ${company} - a comfortable, genuine intro.`;
    default:
      return `Apply directly through the normal posting for ${company}.`;
  }
}

/** 2–4 grounded lines explaining who this is and WHY it's a path. */
function buildReasons(
  conn: Connection,
  target: WarmTarget,
  pathKind: PathKind,
): string[] {
  const reasons: string[] = [
    `${conn.fullName} is a ${degreeWord(conn.degree)}-degree ${relationshipNoun(
      conn.relationship,
    )} at ${target.company}.`,
  ];
  if (conn.howKnown) reasons.push(`How you know them: ${conn.howKnown}.`);
  if (conn.sharedContext) reasons.push(`Shared context: ${conn.sharedContext}.`);
  if (reasons.length < 4) reasons.push(kindBlurb(pathKind, target.company));
  return reasons.slice(0, 4);
}

// --- Path builders ---------------------------------------------------------

function buildPath(conn: Connection, target: WarmTarget): WarmPath {
  const { pathKind, base } = classify(conn);
  const strength = scoreStrength(base, conn.degree);
  // 1st-degree → linkedin; otherwise linkedin too. Only fall back to email
  // when there is no profile URL to message through.
  const channel: IntroChannel = conn.profileUrl ? "linkedin" : "email";

  const reachOut =
    pathKind !== "NONE" && strength >= MIN_STRENGTH_TO_REACH_OUT;
  const gateReason = reachOut
    ? `${kindLabel(pathKind)} path through ${conn.fullName} (strength ${strength.toFixed(
        2,
      )}) - worth a brief, genuine ask.`
    : `Path through ${conn.fullName} is too weak (strength ${strength.toFixed(
        2,
      )} < ${MIN_STRENGTH_TO_REACH_OUT}) - apply cold through the normal posting instead.`;

  return {
    target,
    connection: conn,
    pathKind,
    strength,
    reasons: buildReasons(conn, target, pathKind),
    reachOut,
    gateReason,
    channel,
  };
}

function nonePath(target: WarmTarget): WarmPath {
  return {
    target,
    connection: undefined,
    pathKind: "NONE",
    strength: 0,
    reasons: [`No connection found at ${target.company}.`],
    reachOut: false,
    gateReason: "No warm path - apply directly through the normal posting.",
    channel: "linkedin",
  };
}

// --- Public API ------------------------------------------------------------

/**
 * Every candidate path from `connections` whose person works AT `target`,
 * strongest first. Returns a single NONE path when no genuine tie exists.
 */
export function rankWarmPaths(
  target: WarmTarget,
  connections: Connection[],
): WarmPath[] {
  const matched = connections.filter((c) => worksAtTarget(c, target));
  if (matched.length === 0) return [nonePath(target)];

  const paths = matched.map((c) => buildPath(c, target));
  // Strongest first; stable so equal-strength ties keep input order.
  paths.sort((a, b) => b.strength - a.strength);
  return paths;
}

/** The single strongest path (or the NONE path when there is none). */
export function bestWarmPath(
  target: WarmTarget,
  connections: Connection[],
): WarmPath {
  return rankWarmPaths(target, connections)[0];
}
