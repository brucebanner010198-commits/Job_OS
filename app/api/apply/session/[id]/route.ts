import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-context";
import {
  getSession,
  takeControl,
  pauseForCaptcha,
  resumeAi,
} from "@/lib/apply/session-service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { scope } = await getAppContext();
  const session = await getSession(scope, id);
  if (!session) {
    return NextResponse.json({ session: null });
  }
  return NextResponse.json({ session });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { scope } = await getAppContext();
  const body = (await req.json()) as { action?: string };

  switch (body.action) {
    case "take-control": {
      const session = await takeControl(scope, id);
      return NextResponse.json({ ok: true, session });
    }
    case "pause-captcha": {
      const session = await pauseForCaptcha(scope, id);
      return NextResponse.json({ ok: true, session });
    }
    case "resume-ai": {
      const session = await resumeAi(scope, id);
      return NextResponse.json({ ok: true, session });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
