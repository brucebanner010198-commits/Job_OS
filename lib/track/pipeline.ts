/**
 * Composed ingest pipeline (Phase 6, plan §8d) - the pure glue that runs every
 * brain over a batch of emails and projects the result into the serializable
 * view models the /track page renders.
 *
 * Pure - no DB, no network, no LLM, no wall-clock reads. For each email it
 * chains classify → parse .ics → thread-match → propose, exactly as the service
 * does, so the offline preview and the live DB sync share one code path and the
 * page renders identically in both modes. The OFFLINE preview (previewTrack)
 * runs this over the deterministic fixture corpus.
 */
import type {
  AppRef,
  BoardColumnView,
  ProcessedEmail,
  ProposalView,
  RawEmail,
} from "@/lib/track/types";
import { classifyEmail } from "@/lib/track/classify";
import { parseIcs } from "@/lib/track/ics";
import { matchEmailToApp } from "@/lib/track/threading";
import { proposeStatusChange } from "@/lib/track/proposals";
import { buildBoard } from "@/lib/track/board";
import { fixtureApps, fixtureRawEmails } from "@/lib/track/fixtures";

/**
 * Run the full brain chain over a batch of emails against the known apps.
 *
 * For each email:
 *   classification = classifyEmail(email)
 *   event          = email.icsRaw ? parseIcs(email.icsRaw) : undefined
 *   match          = matchEmailToApp(email, apps)
 *   currentStatus  = the matched app's status (undefined when unlinked)
 *   proposal       = proposeStatusChange(classification, currentStatus)
 *
 * Deterministic and side-effect free.
 */
export function processEmails(
  emails: RawEmail[],
  apps: AppRef[],
): ProcessedEmail[] {
  return emails.map((email) => {
    const classification = classifyEmail(email);
    const event = email.icsRaw ? parseIcs(email.icsRaw) : undefined;
    const match = matchEmailToApp(email, apps);
    const currentStatus = apps.find((a) => a.id === match.applicationId)?.status;
    const proposal = proposeStatusChange(classification, currentStatus);
    return { email, classification, event, match, proposal };
  });
}

/**
 * Flatten one processed email + its proposal into a ProposalView for the UI.
 * `id` is the proposal id (a DB id live, or the Gmail message id in the offline
 * preview). `company` is intentionally left undefined here - the caller fills it
 * from the matched application. ONLY call this when `p.proposal` is non-null.
 */
export function toProposalView(p: ProcessedEmail, id: string): ProposalView {
  const proposal = p.proposal;
  if (proposal === null) {
    // Programming error: the caller must guard on a non-null proposal first.
    throw new Error("toProposalView called on a ProcessedEmail with no proposal");
  }
  return {
    id,
    category: p.classification.category,
    toStatus: proposal.toStatus,
    fromStatus: proposal.fromStatus,
    rationale: proposal.rationale,
    soft: proposal.soft,
    requiresConfirm: proposal.requiresConfirm,
    company: undefined,
    subject: p.email.subject,
    fromEmail: p.email.fromEmail,
    receivedAt: p.email.receivedAt,
    eventStart: p.event?.start,
    eventCancelled: p.event?.cancelled,
    applicationId: p.match.applicationId,
    snippet: p.email.snippet,
  };
}

/**
 * Offline /track preview - PURE, no DB. Projects the fixture applications into
 * the Kanban board and runs the pipeline over the fixture corpus to surface the
 * pending status proposals, so the page renders fully before a real Gmail
 * account (or any database) exists.
 */
export function previewTrack(): {
  board: BoardColumnView[];
  proposals: ProposalView[];
} {
  const board: BoardColumnView[] = buildBoard(fixtureApps).map((col) => ({
    status: col.status,
    title: col.title,
    apps: col.apps.map((app) => ({
      id: app.id,
      company: app.company,
      jobTitle: app.jobTitle,
      status: app.status,
      route: null,
    })),
  }));

  const proposals: ProposalView[] = processEmails(fixtureRawEmails, fixtureApps)
    .filter((p) => p.proposal && p.classification.isJobRelated)
    .map((p) => {
      const v = toProposalView(p, p.email.gmailMessageId);
      v.company = fixtureApps.find((a) => a.id === p.match.applicationId)?.company;
      return v;
    });

  return { board, proposals };
}
