/**
 * Tracker page (Phase 6, plan §8d) - the Kanban board + the Gmail "inbox
 * proposals" queue. Server component: it loads the live board and pending
 * proposals through safeDb, and ALWAYS has a pure offline preview
 * (previewTrack) so the page renders with no database.
 *
 * The safety spine lives here in copy and in the `readOnly` flag passed to the
 * children: Gmail only ever PROPOSES status changes - a human confirms every
 * move into INTERVIEWING / OFFER / REJECTED, where a wrong label is the worst
 * possible bug.
 */
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { getBoardView, listProposalViews, previewTrack } from "@/lib/track/service";
import { gmailStatus, type GmailStatus } from "@/lib/gmail";
import { disconnectGmailAction } from "@/app/actions/track";
import {
  AppliedStageCompose,
  splitBoardForAppliedStage,
} from "@/components/track/applied-stage";
import { TrackBoard } from "@/components/track/track-board";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BoardColumnView, ProposalView } from "@/lib/track/types";

export const dynamic = "force-dynamic";

interface Loaded {
  board: BoardColumnView[];
  proposals: ProposalView[];
}

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  const { gmail } = await searchParams;
  const { scope } = await getAppContext();

  const { data, dbError } = await safeDb<Loaded>(
    async () => {
      const [board, proposals] = await Promise.all([
        getBoardView(scope),
        listProposalViews(scope),
      ]);
      return { board, proposals };
    },
    { board: [], proposals: [] },
  );

  const status: GmailStatus = await gmailStatus(scope).catch(() => ({
    enabled: false,
    connected: false,
    live: false,
  }));

  // Fall back to the pure preview whenever the DB is down OR there's simply
  // nothing to show yet - so the page is never blank.
  const usePreview =
    dbError || (data.board.length === 0 && data.proposals.length === 0);
  const preview = usePreview ? previewTrack() : null;
  const board = preview ? preview.board : data.board;
  const proposals = preview ? preview.proposals : data.proposals;
  const { appliedColumn, restBoard } = splitBoardForAppliedStage(board);

  return (
    <main className="page-container-wide">
      <PageHeader
        title="Applied"
        description="Gmail proposes status changes for submitted applications — you confirm each one. Track cards live in the Applied column below."
      />

      {dbError && <DbBanner />}

      {/* OAuth round-trip notice (?gmail=…) */}
      {gmail === "connected" && (
        <div className="mb-4 rounded-lg border border-[var(--success)]/30 bg-[var(--success)]/10 p-3 text-sm text-[var(--success)]">
          Gmail connected.
        </div>
      )}
      {gmail === "error" && (
        <div className="mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
          Gmail connection failed - try reconnecting.
        </div>
      )}
      {gmail === "unconfigured" && (
        <div className="mb-4 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-3 text-sm text-[var(--warning)]">
          Add GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET to .env first.
        </div>
      )}

      {/* Gmail connection card */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">Gmail</span>
              {status.live ? (
                <Badge variant="success" className="text-[10px]">
                  connected
                </Badge>
              ) : (
                <Badge variant="muted" className="text-[10px]">
                  not connected
                </Badge>
              )}
              {usePreview ? (
                <Badge variant="muted" className="text-[10px]">
                  sample preview
                </Badge>
              ) : (
                <Badge variant="success" className="text-[10px]">
                  live data
                </Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {status.live ? (
                <>Connected as {status.emailAddress ?? "your account"}.</>
              ) : (
                <>
                  Connect Gmail to detect interview invites, offers, and
                  rejections - each one becomes a proposal you confirm.
                </>
              )}
              {usePreview && " The board below is a sample preview."}
            </p>
            {!status.live && !status.enabled && (
              <p className="mt-1 text-xs text-muted-foreground">
                Add your Google OAuth client id/secret to .env to enable.
              </p>
            )}
          </div>

          {status.live ? (
            <form
              action={async () => {
                "use server";
                await disconnectGmailAction();
              }}
            >
              <button
                type="submit"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Disconnect
              </button>
            </form>
          ) : (
            <a
              href="/api/gmail/auth"
              className={buttonVariants({ variant: "accent", size: "sm" })}
            >
              Connect Gmail
            </a>
          )}
        </CardContent>
      </Card>

      <AppliedStageCompose
        proposals={proposals}
        appliedColumn={appliedColumn}
        readOnly={usePreview}
      />
      <TrackBoard board={restBoard} readOnly={usePreview} title="Rest of pipeline" />
    </main>
  );
}
