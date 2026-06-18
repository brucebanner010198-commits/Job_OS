/**
 * Track + Gmail data service (Phase 6) - the ONLY file in the tracker that
 * imports @/lib/db. Every Prisma read/write lives here; the brain modules
 * (classify, ics, threading, proposals, board, pipeline) stay DB-free and
 * unit-testable.
 *
 * Safety spine enforced here (plan §8d, types.ts doc):
 *   - syncInbox PROPOSES but NEVER applies a status change. It is idempotent
 *     (InboxItem deduped by Gmail message id; at most one StatusProposal per
 *     InboxItem) and NEVER throws to the caller - a sync failure degrades to
 *     zero counts, it never crashes the page.
 *   - confirmProposal is the ONLY place a Gmail-derived status change is
 *     applied, and only via an explicit user action. A move into
 *     INTERVIEWING/OFFER/REJECTED therefore always passes through a human.
 *   - OAuth tokens are NEVER touched here - they live in the keychain / local
 *     store (lib/gmail/token-store.ts); this file only persists sync metadata.
 *   - Dates → ISO strings in every returned view model.
 */

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { ApplicationStatus } from "@prisma/client";
import { getGmailSource } from "@/lib/gmail";
import { clearTokens } from "@/lib/gmail/token-store";
import { processEmails } from "@/lib/track/pipeline";
import { COLUMN_TITLES } from "@/lib/track/board";
import { BOARD_COLUMNS } from "@/lib/track/types";
import type {
  AppRef,
  AppStatus,
  BoardAppView,
  BoardColumnView,
  CalendarEvent,
  EmailCategory,
  ProposalView,
  RawEmail,
} from "@/lib/track/types";
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

// --- getBoardView ------------------------------------------------------------

/**
 * The live Kanban board: every application grouped into the BOARD_COLUMNS order
 * with human titles from COLUMN_TITLES. SKIPPED apps have no column and are
 * dropped from the board (they still carry a title for badges elsewhere).
 */
export async function getBoardView(scope: AppScope): Promise<BoardColumnView[]> {
  const apps = await db.application.findMany({
    where: scopeWhere(scope),
    include: { job: true },
    orderBy: { createdAt: "desc" },
  });

  const views: BoardAppView[] = apps.map((app) => ({
    id: app.id,
    company: app.job.company,
    jobTitle: app.job.title,
    status: app.status as AppStatus,
    route: app.route,
  }));

  return BOARD_COLUMNS.map((status) => ({
    status,
    title: COLUMN_TITLES[status],
    apps: views.filter((v) => v.status === status),
  }));
}

// --- syncInbox -------------------------------------------------------------

/**
 * Pull job-relevant emails from the active Gmail source, classify + thread +
 * propose, and persist the result. IDEMPOTENT and NEVER-THROWS:
 *
 *   - listJobEmails is wrapped so a network/auth failure yields [] (no rows).
 *   - InboxItem is deduped by the (userId, gmailMessageId) unique - a re-sync
 *     skips existing rows (no double-create) and only counts genuinely new ones.
 *   - At most one StatusProposal exists per InboxItem (unique inboxItemId); a
 *     re-sync backfills a proposal for an item that didn't have one yet.
 *   - The whole persistence block is guarded; any DB error degrades to the
 *     counts gathered so far rather than throwing to the caller.
 *
 * This PROPOSES only - no status is applied here (see confirmProposal).
 */
export async function syncInbox(
  scope: AppScope,
): Promise<{ created: number; proposals: number; live: boolean; source: string }> {
  let created = 0;
  let proposals = 0;

  const source = await getGmailSource(scope);

  let emails: RawEmail[] = [];
  try {
    emails = await source.listJobEmails({ sinceDays: 90, max: 50 });
  } catch {
    emails = [];
  }

  try {
    // Load the user's applications as the threading candidate set.
    const dbApps = await db.application.findMany({
      where: scopeWhere(scope),
      include: { job: true },
    });

    const apps: AppRef[] = dbApps.map((app) => ({
      id: app.id,
      status: app.status as AppStatus,
      company: app.job.company,
      companyDomain: hostnameOf(app.job.url),
      jobTitle: app.job.title,
      gmailThreadIds: [],
      rfcMessageIds: [],
    }));

    const processed = processEmails(emails, apps);

    // Pass 1 - persist new InboxItems (idempotent dedupe by Gmail message id).
    for (const p of processed) {
      const existing = await db.inboxItem.findUnique({
        where: {
          profileId_gmailMessageId: {
            profileId: scope.profileId,
            gmailMessageId: p.email.gmailMessageId,
          },
        },
      });
      if (existing) continue; // already ingested - no-op

      await db.inboxItem.create({
        data: {
          ...scopeData(scope),
          gmailMessageId: p.email.gmailMessageId,
          gmailThreadId: p.email.gmailThreadId,
          rfcMessageId: p.email.rfcMessageId ?? null,
          fromEmail: p.email.fromEmail,
          fromDomain: p.email.fromDomain ?? null,
          subject: p.email.subject,
          snippet: p.email.snippet ?? null,
          receivedAt: new Date(p.email.receivedAt),
          category: p.classification.category,
          confidence: p.classification.confidence,
          reasons: p.classification.reasons as unknown as Prisma.InputJsonValue,
          event: p.event
            ? (p.event as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          applicationId: p.match.applicationId ?? null,
        },
      });
      created += 1;
    }

    // Pass 2 - surface a StatusProposal for each linked, move-warranting email,
    // unless this InboxItem already has one. Never applies the move.
    for (const p of processed) {
      if (p.proposal === null || !p.match.applicationId) continue;

      const inboxItem = await db.inboxItem.findUnique({
        where: {
          profileId_gmailMessageId: {
            profileId: scope.profileId,
            gmailMessageId: p.email.gmailMessageId,
          },
        },
      });
      if (!inboxItem) continue;

      const existingProposal = await db.statusProposal.findUnique({
        where: { inboxItemId: inboxItem.id },
      });
      if (existingProposal) continue; // one proposal per item - idempotent

      await db.statusProposal.create({
        data: {
          ...scopeData(scope),
          inboxItemId: inboxItem.id,
          applicationId: p.match.applicationId,
          fromStatus: (p.proposal.fromStatus ?? null) as ApplicationStatus | null,
          toStatus: p.proposal.toStatus as ApplicationStatus,
          rationale: p.proposal.rationale,
          requiresConfirm: p.proposal.requiresConfirm,
          state: "PENDING",
        },
      });
      proposals += 1;
    }

    // Persist sync metadata (watermark + last-synced). OAuth tokens are NOT
    // stored here - only this idempotent sync bookkeeping.
    const existingAccount = await db.gmailAccount.findUnique({
      where: { profileId: scope.profileId },
    });
    const fetchedHistoryId = source.currentHistoryId
      ? await source.currentHistoryId()
      : undefined;
    const emailAddress =
      source.emailAddress ?? existingAccount?.emailAddress ?? "";
    const historyId =
      fetchedHistoryId ?? existingAccount?.historyId ?? null;

    await db.gmailAccount.upsert({
      where: { profileId: scope.profileId },
      create: {
        ...scopeData(scope),
        emailAddress,
        historyId,
        lastSyncedAt: new Date(),
        connected: source.isLive,
      },
      update: {
        emailAddress,
        historyId,
        lastSyncedAt: new Date(),
        connected: source.isLive,
      },
    });
  } catch {
    // NEVER throw to the caller - degrade to the counts gathered so far.
  }

  return { created, proposals, live: source.isLive, source: source.id };
}

// --- listProposalViews -------------------------------------------------------

/** All PENDING proposals for the user, flattened with their source email. */
export async function listProposalViews(
  scope: AppScope,
): Promise<ProposalView[]> {
  const rows = await db.statusProposal.findMany({
    where: { ...scopeWhere(scope), state: "PENDING" },
    include: { inboxItem: true, application: { include: { job: true } } },
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => {
    const event =
      row.inboxItem.event !== null
        ? (row.inboxItem.event as unknown as CalendarEvent)
        : null;
    return {
      id: row.id,
      category: row.inboxItem.category as EmailCategory,
      toStatus: row.toStatus as AppStatus,
      fromStatus: (row.fromStatus ?? undefined) as AppStatus | undefined,
      rationale: row.rationale,
      soft: row.inboxItem.category === "SOFT_REJECTION",
      requiresConfirm: row.requiresConfirm,
      company: row.application?.job.company,
      subject: row.inboxItem.subject,
      fromEmail: row.inboxItem.fromEmail,
      receivedAt: row.inboxItem.receivedAt.toISOString(),
      eventStart: event?.start,
      eventCancelled: event?.cancelled,
      applicationId: row.applicationId ?? undefined,
      snippet: row.inboxItem.snippet ?? undefined,
    };
  });
}

// --- confirmProposal ---------------------------------------------------------

/**
 * Apply a pending proposal - the ONLY place a Gmail-derived status change is
 * committed, and only via this explicit user action. No-op unless the proposal
 * is still PENDING and carries an applicationId (the human is always the gate
 * for INTERVIEWING/OFFER/REJECTED). Writes an audit event.
 */
export async function confirmProposal(
  scope: AppScope,
  proposalId: string,
): Promise<void> {
  const proposal = await db.statusProposal.findFirstOrThrow({
    where: { id: proposalId, ...scopeWhere(scope) },
    include: {
      application: { include: { job: true } },
      inboxItem: true,
    },
  });

  if (proposal.state !== "PENDING") return;
  if (!proposal.applicationId) return;

  await db.application.update({
    where: { id: proposal.applicationId },
    data: { status: proposal.toStatus },
  });

  await db.statusProposal.update({
    where: { id: proposal.id },
    data: { state: "CONFIRMED", decidedAt: new Date() },
  });

  await db.applicationEvent.create({
    data: {
      applicationId: proposal.applicationId,
      type: "status_confirmed",
      detail: {
        from: proposal.fromStatus,
        to: proposal.toStatus,
        via: "gmail",
      } as unknown as Prisma.InputJsonValue,
    },
  });

  if (proposal.toStatus === "REJECTED" && proposal.inboxItem) {
    const { captureRejectionOnConfirm } = await import(
      "@/lib/track/rejection-learning-store"
    );
    await captureRejectionOnConfirm(scope, {
      toStatus: proposal.toStatus,
      applicationId: proposal.applicationId,
      rationale: proposal.rationale,
      inboxItem: proposal.inboxItem,
      application: proposal.application,
    });
  }
}

// --- dismissProposal ---------------------------------------------------------

/** Decline a pending proposal - never touches the application's status. */
export async function dismissProposal(
  scope: AppScope,
  proposalId: string,
): Promise<void> {
  await db.statusProposal.updateMany({
    where: { id: proposalId, ...scopeWhere(scope) },
    data: { state: "DISMISSED", decidedAt: new Date() },
  });
}

// --- moveApplication ---------------------------------------------------------

/**
 * Manual drag of an application to a new column. This is a direct human action
 * (not Gmail-derived), so it applies immediately and records a "manual" event.
 */
export async function moveApplication(
  scope: AppScope,
  applicationId: string,
  toStatus: AppStatus,
): Promise<void> {
  await db.application.updateMany({
    where: { id: applicationId, ...scopeWhere(scope) },
    data: { status: toStatus as ApplicationStatus },
  });

  await db.applicationEvent.create({
    data: {
      applicationId,
      type: "status_moved",
      detail: { to: toStatus, via: "manual" } as unknown as Prisma.InputJsonValue,
    },
  });
}

// --- disconnectGmail ---------------------------------------------------------

/** Forget the OAuth tokens and mark the account disconnected. */
export async function disconnectGmail(scope: AppScope): Promise<void> {
  await clearTokens(scope.profileId);

  const existing = await db.gmailAccount.findUnique({
    where: { profileId: scope.profileId },
  });
  if (existing) {
    await db.gmailAccount.update({
      where: { profileId: scope.profileId },
      data: { connected: false },
    });
  }
}

// --- offline preview (re-export) ----------------------------------------------

export { previewTrack } from "@/lib/track/pipeline";
