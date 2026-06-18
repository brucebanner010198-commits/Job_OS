/**
 * Company brief data service (Phase 4).
 *
 * The ONLY file in lib/brief/* that imports @/lib/db (Prisma).
 * All other brief modules are pure / DB-free; this layer wires them to
 * persistence and exposes the same CompanyBriefData shape callers expect.
 *
 * Follows the same pattern as lib/goals/service.ts:
 *   - Prisma is isolated here; domain types never import @prisma/client.
 *   - JSON columns cast via `as unknown as Prisma.InputJsonValue` on write,
 *     and `as unknown as T` on read - identical to the goals service convention.
 *   - Date fields stored in JSON (claims[].retrievedAt) are re-hydrated to
 *     Date objects so callers always receive well-typed CompanyBriefData.
 *   - previewBrief is the no-DB path for graceful degradation (no Postgres).
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import { fetchSources, briefFixtures } from "@/lib/brief/sources";
import { proposeCandidates } from "@/lib/brief/candidates";
import { composeBrief } from "@/lib/brief/compose";
import { type Claim, type CompanyBriefData } from "@/lib/brief/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * JSON-stored Claim rows have retrievedAt as an ISO string, not a Date.
 * Re-hydrate them back to proper Date objects so the return type is correct.
 */
type RawClaim = Omit<Claim, "retrievedAt"> & { retrievedAt: string };

function hydrateClaims(raw: unknown): Claim[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawClaim[]).map((c) => ({
    ...c,
    retrievedAt: new Date(c.retrievedAt),
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a company brief, persist it, and return the full CompanyBriefData.
 *
 * Pipeline:
 *   fetchSources(company)          →  FetchedSource[]
 *   proposeCandidates(sources)     →  CandidateClaim[]
 *   composeBrief({ ... })          →  CompanyBriefData
 *   upsert Company row             (userId + name unique key)
 *   create CompanyBrief row        (summary + claims JSON)
 *   return CompanyBriefData
 *
 * If sources is empty (unknown company or no fixtures), composeBrief returns
 * an empty brief (no claims, empty summary). This function never throws on
 * empty sources - it always returns a valid CompanyBriefData.
 *
 * @param now  Override "now" for testing / deterministic generation.
 */
export async function generateBrief(
  scope: AppScope,
  company: { name: string; domain?: string },
  now?: Date,
): Promise<CompanyBriefData> {
  const effectiveNow = now ?? new Date();

  const sources = await fetchSources(company);
  const candidates = proposeCandidates(sources);
  const brief = composeBrief({ company, candidates, sources, now: effectiveNow });

  // Upsert Company - unique on (userId, name); update domain if provided
  const co = await db.company.upsert({
    where: {
      profileId_name: { profileId: scope.profileId, name: company.name },
    },
    create: {
      ...scopeData(scope),
      name: company.name,
      domain: company.domain ?? null,
    },
    update: { domain: company.domain ?? null },
  });

  await db.companyBrief.create({
    data: {
      ...scopeData(scope),
      companyId: co.id,
      summary: brief.summary,
      claims: brief.claims as unknown as Prisma.InputJsonValue,
      generatedAt: effectiveNow,
    },
  });

  return brief;
}

/**
 * Retrieve the most recent CompanyBrief for a named company.
 * Returns null if the company hasn't been briefed yet.
 *
 * Note: refused[] is always empty on historical briefs - refused claims are
 * never persisted (they are shown only at generation time).
 */
export async function getLatestBrief(
  scope: AppScope,
  companyName: string,
): Promise<CompanyBriefData | null> {
  const co = await db.company.findUnique({
    where: { profileId_name: { profileId: scope.profileId, name: companyName } },
    include: {
      briefs: {
        orderBy: { generatedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!co || co.briefs.length === 0) return null;

  const row = co.briefs[0];

  return {
    company: co.name,
    domain: co.domain ?? undefined,
    summary: row.summary ?? "",
    claims: hydrateClaims(row.claims as unknown),
    refused: [],
    generatedAt: row.generatedAt,
  };
}

/**
 * Ensure a company brief exists - return the latest brief or generate one.
 * Used by autopilot before prepare so apply materials have company context.
 */
export async function ensureBrief(
  scope: AppScope,
  company: { name: string; domain?: string },
  now?: Date,
): Promise<CompanyBriefData> {
  const existing = await getLatestBrief(scope, company.name);
  if (existing) return existing;
  return generateBrief(scope, company, now);
}

export async function listBriefedCompanies(
  scope: AppScope,
): Promise<{ name: string; domain: string | null; generatedAt: string }[]> {
  const companies = await db.company.findMany({
    where: scopeWhere(scope),
    include: {
      briefs: {
        orderBy: { generatedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return companies
    .filter((c) => c.briefs.length > 0)
    .map((c) => ({
      name: c.name,
      domain: c.domain,
      generatedAt: c.briefs[0].generatedAt.toISOString(),
    }));
}

/**
 * Pure offline brief - full pipeline with NO database call.
 *
 * Used by the companies page as a graceful-degradation fallback when Postgres
 * is unavailable, and by any caller that wants a preview without persistence.
 *
 * briefFixtures is a synchronous Record so this function is synchronous.
 * Unknown companies return an empty brief (no claims, empty summary).
 */
export function previewBrief(
  company: { name: string; domain?: string },
  now: Date,
): CompanyBriefData {
  const sources = briefFixtures[company.name] ?? [];
  const candidates = proposeCandidates(sources);
  return composeBrief({ company, candidates, sources, now });
}
