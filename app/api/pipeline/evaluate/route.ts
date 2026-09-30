import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { evaluateAndSaveJobPosting, processEvaluationQueue } from "@/lib/apply/jev/evaluator";

export async function GET() {
  try {
    const { scope } = await getAppContext();
    const postings = await db.jobPosting.findMany({
      where: { profileId: scope.profileId },
      include: {
        evaluation: true,
        application: true,
      },
      orderBy: {
        evaluation: {
          fitScore: "desc",
        },
      },
    });

    return NextResponse.json({ ok: true, postings });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { scope } = await getAppContext();
    const body = await req.json();

    if (Array.isArray(body.urls)) {
      const queueResults = await processEvaluationQueue(body.urls, scope);
      return NextResponse.json({ ok: true, results: queueResults });
    }

    if (!body.url) {
      return NextResponse.json({ error: "Missing required parameter: url" }, { status: 400 });
    }

    const result = await evaluateAndSaveJobPosting(body.url, scope, {
      title: body.title,
      company: body.company,
      location: body.location,
      description: body.description,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    console.error("Evaluation API error:", err);
    const message = err instanceof Error ? err.message : "Evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
