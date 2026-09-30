import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/app-context";
import { db } from "@/lib/db";
import { runDrafterReviewerPipeline } from "@/lib/pipeline/drafter-reviewer";

export async function POST(req: Request) {
  try {
    const { scope } = await getAppContext();
    const body = await req.json();

    let jobTitle = body.jobTitle;
    let company = body.company;
    let jobDescription = body.jobDescription;
    let keywords = body.keywords;
    const jobPostingId = body.jobPostingId;

    if (jobPostingId) {
      const posting = await db.jobPosting.findUnique({
        where: { id: jobPostingId },
        include: { evaluation: true },
      });

      if (!posting) {
        return NextResponse.json({ error: "JobPosting not found" }, { status: 404 });
      }

      jobTitle = jobTitle || posting.title;
      company = company || posting.company;
      jobDescription = jobDescription || posting.description;
      keywords = keywords || posting.evaluation?.missingKeywords || [];
    }

    if (!jobTitle || !jobDescription) {
      return NextResponse.json(
        { error: "Missing required fields: jobTitle and jobDescription are required" },
        { status: 400 },
      );
    }

    const result = await runDrafterReviewerPipeline({
      jobPostingId,
      jobTitle,
      company: company || "Hiring Company",
      jobDescription,
      keywords,
      scope,
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (err: unknown) {
    console.error("Drafter-Reviewer API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error during Drafter-Reviewer chain";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
