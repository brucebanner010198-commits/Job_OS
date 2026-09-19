import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppContextSafe } from "@/lib/app-context";
import { listFacts, toFacts } from "@/lib/profile/service";

/**
 * Local API bridge for the Job OS browser extension.
 * Serves verified profile facts and application answers to the user's active browser session.
 */
export async function GET() {
  const { scope, profile, dbError } = await getAppContextSafe();
  if (dbError) {
    return NextResponse.json({ error: "Database not ready" }, { status: 503 });
  }

  const [rawFacts, answers] = await Promise.all([
    listFacts(scope),
    db.applicationAnswers.findUnique({ where: { profileId: scope.profileId } }),
  ]);

  const facts = toFacts(rawFacts);

  // Extract primary contact details
  const contactFact = facts.find((f) => f.kind === "CONTACT")?.data as Record<string, string> | undefined;
  const summaryFact = facts.find((f) => f.kind === "SUMMARY")?.data as Record<string, string> | undefined;

  return NextResponse.json({
    status: "ok",
    profile: {
      id: profile.id,
      name: profile.name,
      email: contactFact?.email || "",
      phone: contactFact?.phone || "",
      linkedin: answers?.linkedinUrl || contactFact?.linkedin || "",
      github: answers?.githubUrl || contactFact?.github || "",
      website: answers?.websiteUrl || contactFact?.portfolio || "",
      summary: summaryFact?.text || "",
      workAuthorized: answers?.workAuthorized ?? true,
      requiresSponsorship: answers?.requiresSponsorship ?? false,
      yearsExperience: answers?.yearsExperience || 5,
      salaryExpectation: answers?.salaryExpectation,
      noticePeriod: answers?.noticePeriod || "2 weeks",
      locations: answers?.locations || [],
    },
    factsCount: facts.length,
  });
}
