import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { scopeWhere } from "@/lib/profiles/scope";
import { heldInstruction } from "@/lib/apply/human-gate";

/**
 * Applications waiting on the user right now, for the "Human, please take
 * over" pop-up: PAUSED (a human-only step before the form) and HANDOFF (filled,
 * waiting for review and submit). Gated by proxy.ts like every /api/apply path.
 */
export async function GET() {
  const { scope } = await getAppContext();
  const rows = await db.application.findMany({
    where: { ...scopeWhere(scope), applyState: { in: ["PAUSED", "HANDOFF"] } },
    include: {
      job: { select: { company: true, title: true } },
      events: {
        where: { type: { in: ["paused_for_human", "stopped_at_review", "pause_expired"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { type: true, detail: true, createdAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  const items = rows.map((r) => {
    const event = r.events[0];
    const detail = (event?.detail ?? {}) as { instruction?: string; unanswered?: string[] };
    return {
      id: r.id,
      state: r.applyState,
      company: r.job.company,
      title: r.job.title,
      since: (event?.createdAt ?? r.updatedAt).toISOString(),
      instruction:
        r.applyState === "PAUSED"
          ? (heldInstruction(r.id) ?? detail.instruction ?? "The page needs you. Check the browser window.")
          : event?.type === "pause_expired"
            ? "The browser window closed. Open the job and finish the application yourself."
            : "Review the filled application in the browser window and submit it.",
      // A paused run can carry on only while its browser window is still held.
      canContinue: r.applyState === "PAUSED" && heldInstruction(r.id) !== null,
      leftForYou: r.applyState === "HANDOFF" ? (detail.unanswered ?? []).slice(0, 8) : [],
    };
  });

  return NextResponse.json({ items });
}
