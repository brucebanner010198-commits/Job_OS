/**
 * Warm-path data service (Phase 7) - the ONLY file in this module that imports
 * @/lib/db. Every Prisma read/write lives here; the brains (rank, draft) and the
 * pipeline stay DB-free and unit-testable.
 *
 * Safety spine enforced here (plan §9, Hardening §B/§F):
 *   - TRUTHFUL / EXTRACTIVE: drafts come straight from draftIntroRequest, which is
 *     grounded only in real Connection/profile facts. We persist its provenanceOk
 *     verbatim; markIntroSent is a NO-OP unless provenanceOk is true, so an
 *     ungrounded draft can never be "sent".
 *   - HUMAN-IN-THE-LOOP / DRAFT-FIRST: generateIntro only PROPOSES (state
 *     PROPOSED). The app never sends - the human marks it sent after sending from
 *     their own account.
 *   - LOW-VOLUME / ETIQUETTE: WarmIntro is unique per (userId, company), so the
 *     ask is at most one per company; generateIntro upserts that single row.
 *   - refreshConnections is idempotent (find-first dedupe by name+company) and
 *     NEVER throws - a failing source degrades to the counts gathered so far.
 */

import { db } from "@/lib/db";
import { bestWarmPath } from "@/lib/warm/rank";
import { draftIntroRequest } from "@/lib/warm/draft";
import { getConnectionSource } from "@/lib/warm";
import type {
  Connection,
  ConnectionRelationship,
  RequesterProfile,
  WarmIntroState,
  WarmPathView,
  WarmTarget,
} from "@/lib/warm/types";
import type { AppScope } from "@/lib/profiles/types";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";

// --- helpers ---------------------------------------------------------------

/** Lowercased hostname of a job URL, or undefined when absent/invalid. */
function hostnameOf(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

/** A persisted Connection row, mapped to the Prisma-free Connection shape. */
type ConnectionRow = {
  id: string;
  fullName: string;
  headline: string | null;
  company: string | null;
  companyDomain: string | null;
  title: string | null;
  relationship: string;
  degree: number;
  howKnown: string | null;
  sharedContext: string | null;
  profileUrl: string | null;
  source: string;
};

/** DB row → Connection (nulls → undefined; typed-string columns → unions). */
function toConnection(row: ConnectionRow): Connection {
  return {
    id: row.id,
    fullName: row.fullName,
    headline: row.headline ?? undefined,
    company: row.company ?? undefined,
    companyDomain: row.companyDomain ?? undefined,
    title: row.title ?? undefined,
    relationship: row.relationship as ConnectionRelationship,
    degree: row.degree as 1 | 2 | 3,
    howKnown: row.howKnown ?? undefined,
    sharedContext: row.sharedContext ?? undefined,
    profileUrl: row.profileUrl ?? undefined,
    source: row.source as Connection["source"],
  };
}

/** The requester's grounding profile - real name only (extractive). */
function requesterFrom(
  user: { name: string | null; email: string } | null,
): RequesterProfile {
  const local = user?.email.split("@")[0];
  return { fullName: user?.name ?? local ?? "Me" };
}

// --- getWarmBoard ------------------------------------------------------------

/**
 * The live warm-path board: every pre-cold application (WARM_PATH / TO_APPLY)
 * ranked against the user's network, with the strongest genuine path and (when a
 * draft exists) its ask. A persisted WarmIntro for the company overrides the
 * freshly computed draft - its stored state / draft / provenanceOk win, and the
 * view carries the real WarmIntro id so the UI can mark-sent / skip it.
 */
export async function getWarmBoard(scope: AppScope): Promise<WarmPathView[]> {
  const user = await db.user.findUnique({ where: { id: scope.userId } });
  const requester = requesterFrom(user);

  const apps = await db.application.findMany({
    where: {
      ...scopeWhere(scope),
      status: { in: ["WARM_PATH", "TO_APPLY"] },
    },
    include: { job: true },
    orderBy: { createdAt: "desc" },
  });

  const targets: WarmTarget[] = apps.map((app) => ({
    company: app.job.company,
    companyDomain: hostnameOf(app.job.url),
    jobTitle: app.job.title,
    applicationId: app.id,
  }));

  const connRows = await db.connection.findMany({ where: scopeWhere(scope) });
  const connections: Connection[] = connRows.map(toConnection);

  const intros = await db.warmIntro.findMany({ where: scopeWhere(scope) });
  const introByCompany = new Map(intros.map((i) => [i.company, i] as const));

  return targets.map((target) => {
    const path = bestWarmPath(target, connections);
    const draft = path.reachOut
      ? draftIntroRequest(path, requester)
      : undefined;
    const existing = introByCompany.get(target.company);

    return {
      id: existing?.id ?? `board-${target.company}`,
      company: target.company,
      jobTitle: target.jobTitle,
      applicationId: target.applicationId,
      pathKind: path.pathKind,
      strength: path.strength,
      reasons: path.reasons,
      reachOut: path.reachOut,
      gateReason: path.gateReason,
      connectionName: path.connection?.fullName,
      connectionHeadline: path.connection?.headline,
      connectionProfileUrl: path.connection?.profileUrl,
      channel: path.channel,
      // A stored intro's draft + provenance + lifecycle override the computed draft.
      draftSubject: existing
        ? existing.draftSubject ?? undefined
        : draft?.subject,
      draftBody: existing ? existing.draftBody : draft?.body,
      provenanceOk: existing ? existing.provenanceOk : draft?.provenanceOk,
      state: (existing?.state ?? "PROPOSED") as WarmIntroState,
    };
  });
}

// --- refreshConnections ------------------------------------------------------

/**
 * Pull the user's network from the active ConnectionSource and persist any new
 * people. IDEMPOTENT and NEVER-THROWS:
 *   - listConnections is wrapped so a missing session / disabled flag yields [].
 *   - A row is deduped by find-first on (userId, fullName, company); only
 *     genuinely new people are created and counted.
 *   - The persistence block is guarded - any DB error degrades to the counts so
 *     far rather than throwing into the page.
 * This NEVER contacts anyone - it only reads the user's own network.
 */
export async function refreshConnections(
  scope: AppScope,
): Promise<{ created: number; live: boolean; source: string }> {
  let created = 0;
  const source = await getConnectionSource();

  let rows: Connection[] = [];
  try {
    rows = await source.listConnections();
  } catch {
    rows = [];
  }

  try {
    for (const c of rows) {
      const existing = await db.connection.findFirst({
        where: {
          ...scopeWhere(scope),
          fullName: c.fullName,
          company: c.company ?? null,
        },
      });
      if (existing) continue; // already known - no-op

      await db.connection.create({
        data: {
          ...scopeData(scope),
          fullName: c.fullName,
          headline: c.headline ?? null,
          company: c.company ?? null,
          companyDomain: c.companyDomain ?? null,
          title: c.title ?? null,
          relationship: c.relationship,
          degree: c.degree,
          howKnown: c.howKnown ?? null,
          sharedContext: c.sharedContext ?? null,
          profileUrl: c.profileUrl ?? null,
          source: c.source,
        },
      });
      created += 1;
    }
  } catch {
    // NEVER throw - degrade to the counts gathered so far.
  }

  return { created, live: source.isLive, source: source.id };
}

// --- generateIntro -----------------------------------------------------------

/**
 * Draft (PROPOSE) the single warm-intro ask for a company. Ranks the user's real
 * network for the target, drafts only from that real data, and upserts the one WarmIntro per
 * (userId, company) - so re-generating re-drafts in place rather than spamming.
 * Stores provenanceOk verbatim; an ungrounded draft (provenanceOk=false) is saved
 * but cannot be marked sent. This only PROPOSES - it never sends.
 */
export async function generateIntro(
  scope: AppScope,
  company: string,
  applicationId: string | null,
): Promise<void> {
  const user = await db.user.findUnique({ where: { id: scope.userId } });
  const requester = requesterFrom(user);

  // Enrich the target from the linked application's job, when there is one.
  let companyDomain: string | undefined;
  let jobTitle: string | undefined;
  if (applicationId) {
    const app = await db.application.findFirst({
      where: { id: applicationId, ...scopeWhere(scope) },
      include: { job: true },
    });
    if (app) {
      companyDomain = hostnameOf(app.job.url);
      jobTitle = app.job.title;
    }
  }

  const target: WarmTarget = {
    company,
    companyDomain,
    jobTitle,
    applicationId: applicationId ?? undefined,
  };

  const connRows = await db.connection.findMany({ where: scopeWhere(scope) });
  const connections: Connection[] = connRows.map(toConnection);

  const path = bestWarmPath(target, connections);
  const draft = draftIntroRequest(path, requester);

  const data = {
    connectionId: path.connection?.id ?? null,
    pathKind: path.pathKind,
    channel: path.channel,
    draftSubject: draft.subject ?? null,
    draftBody: draft.body,
    rationale: path.gateReason,
    provenanceOk: draft.provenanceOk,
    state: "PROPOSED" as const,
  };

  await db.warmIntro.upsert({
    where: { profileId_company: { profileId: scope.profileId, company } },
    create: {
      ...scopeData(scope),
      company,
      applicationId: applicationId ?? null,
      ...data,
    },
    update: {
      applicationId: applicationId ?? null,
      ...data,
    },
  });
}

// --- markIntroSent -----------------------------------------------------------

/**
 * The human sent the ask from their own account → record it as SENT. GUARDED by
 * provenanceOk: the updateMany only matches a row whose provenanceOk is true, so
 * an ungrounded draft is a silent no-op (we never "send" an unbacked message).
 */
export async function markIntroSent(
  scope: AppScope,
  warmIntroId: string,
): Promise<void> {
  await db.warmIntro.updateMany({
    where: { id: warmIntroId, ...scopeWhere(scope), provenanceOk: true },
    data: { state: "SENT", decidedAt: new Date() },
  });
}

// --- skipIntro ---------------------------------------------------------------

/** Dismiss the ask for this company - no message is ever sent. */
export async function skipIntro(
  scope: AppScope,
  warmIntroId: string,
): Promise<void> {
  await db.warmIntro.updateMany({
    where: { id: warmIntroId, ...scopeWhere(scope) },
    data: { state: "SKIPPED", decidedAt: new Date() },
  });
}

// --- offline preview (re-export) ----------------------------------------------

export { previewWarm } from "@/lib/warm/pipeline";
