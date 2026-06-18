/**
 * Interview prep page (Phase 8, plan §5) - the prep board.
 *
 * Three progressive modes on one page:
 *   - STUDY is the always-free, fully-offline core: likely questions with grounded
 *     STAR model answers assembled ONLY from the user's real profile facts (never
 *     invented), with every sensitive fact withheld before anything is shown.
 *   - AI_SCREEN + REAL_HR are the live voice mocks. They are COST-CAPPED (a hard
 *     per-session limit and a daily kill-switch) and, until ElevenLabs is
 *     configured, run as zero-cost scripted mock sessions - so the whole flow is
 *     demonstrable with no API key and no spend.
 *
 * Server component: it loads through safeDb and ALWAYS falls back to the pure
 * offline preview (previewInterview) when the DB is unreachable OR there is no
 * prep yet, so the board renders identically with or without a database. The
 * client board (mode picker + live session) is rendered read-only in preview.
 */
import { getAppContext } from "@/lib/app-context";
import { safeDb } from "@/lib/safe";
import { DbBanner } from "@/components/db-banner";
import { Badge } from "@/components/ui/badge";
import { getInterviewBoard, previewInterview } from "@/lib/interview/service";
import { InterviewBoard } from "@/components/interview/interview-board";
import { PageHeader } from "@/components/page-header";
import type { InterviewBoardView } from "@/lib/interview/types";

export const dynamic = "force-dynamic";

/** Whole minutes, floored - the daily budget shown on the voice card. */
function minutesLeft(sec: number): number {
  return Math.max(0, Math.floor(sec / 60));
}

export default async function InterviewPage() {
  // DB read, protected; falls back to the pure offline preview below.
  const boardRes = await safeDb<InterviewBoardView | null>(async () => {
    const { scope, user } = await getAppContext();
    return getInterviewBoard(scope);
  }, null);

  // Use the offline preview whenever the DB is down OR there is no prep yet, so
  // the board is never blank and the entire flow stays demonstrable.
  const usePreview =
    boardRes.dbError || !boardRes.data || boardRes.data.preps.length === 0;
  const board: InterviewBoardView = usePreview
    ? previewInterview()
    : (boardRes.data as InterviewBoardView);

  // Live voice is "configured" only when the key + an agent id are present AND it
  // is not force-disabled; otherwise everything runs as a zero-cost mock.
  const voiceLive = board.voice.configured && board.voice.enabled;

  return (
    <main className="page-container max-w-4xl">
      <PageHeader
        title="Interview prep"
        description="Study mode is always free and works offline. It builds likely questions with STAR answers from your real profile, never invented, and keeps sensitive details private. The voice mocks (an automated AI screen and a warm real-HR manager) have cost caps and run as free scripted sessions until you add an ElevenLabs key."
        action={
          usePreview ? (
            <Badge variant="muted" className="text-[10px]">
              sample preview
            </Badge>
          ) : (
            <Badge variant="success" className="text-[10px]">
              live data
            </Badge>
          )
        }
      />

      {boardRes.dbError && <DbBanner />}

      {/* Voice status - configured vs mock, with the daily budget remaining. */}
      <section className="surface-card mb-8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Live voice</h2>
            {voiceLive ? (
              <Badge variant="success" className="text-[10px]">
                configured
              </Badge>
            ) : (
              <Badge variant="muted" className="text-[10px]">
                mock mode
              </Badge>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {minutesLeft(board.dailyRemainingSec)} min left today
          </span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {board.voice.detail}
        </p>
      </section>

      {/* Prep cards - the client board owns the mode picker + live session. */}
      <InterviewBoard
        preps={board.preps}
        voice={board.voice}
        caps={board.caps}
        dailyRemainingSec={board.dailyRemainingSec}
        readOnly={usePreview}
      />
    </main>
  );
}
