/**
 * JEV Evaluator CLI runner.
 * 
 * Duplicated and modified from scripts/jev-trial.ts to act as our universal Job Evaluator.
 * Modifies the LLM prompt to output fit scores (0-100), pros, cons, and keywords
 * instead of form field answers.
 * 
 * Usage:
 *   npx tsx scripts/jev-evaluator.ts urls.txt [out.jsonl] [--profile <id>] [--headed]
 *   npx tsx scripts/jev-evaluator.ts https://boards.greenhouse.io/example/jobs/12345
 */

import "dotenv/config";
import { appendFileSync, mkdtempSync, readFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { db, disconnectDatabase } from "@/lib/db";
import {
  evaluateJobFit,
  scrapeJobUrl,
  compileMasterProfileContext,
  syncSkillGapsToLearningGoals,
  type EvaluationResult,
} from "@/lib/apply/jev/evaluator";

const FALLBACK_PERSONA_CONTEXT = `CANDIDATE NAME: Test Applicant
CORE COMPETENCIES: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "Prisma", "Docker", "TailwindCSS"]
EXPERIENCE: [
  {"title": "Senior Full-Stack Engineer", "company": "Example Corp", "years": 4, "highlights": ["Built distributed microservices", "Led frontend migration to Next.js App Router"]},
  {"title": "Software Engineer", "company": "TechStart Inc", "years": 2, "highlights": ["Designed REST and GraphQL APIs", "Maintained CI/CD pipelines"]}
]
EDUCATION: [{"degree": "B.S. Computer Science", "school": "State University", "year": 2018}]
BEHAVIORAL TRAITS: ["Collaborative", "Fast learner", "Systematic debugger", "Direct communicator"]
DEAL-BREAKERS: ["Requires minimum $130,000 base salary", "Refuses mandatory full-time in-office (must offer hybrid or remote)", "Requires employer that does not mandate active government security clearance"]
APPLICATION PREFERENCES:
- Work Authorized: Yes
- Requires Visa Sponsorship: No
- Remote Preference: Hybrid or Remote
- Years Experience: 6`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith("--")));
  const nonFlags = args.filter((a) => !a.startsWith("--"));

  if (nonFlags.length === 0) {
    console.log("Usage: npx tsx scripts/jev-evaluator.ts <urls.txt | url> [out.jsonl] [--profile <profileId>] [--headed]");
    process.exit(1);
  }

  const inputSource = nonFlags[0]!;
  const outFile = nonFlags[1] || "evaluations.jsonl";

  // Parse --profile if passed
  const profileFlagIdx = args.indexOf("--profile");
  const profileId = profileFlagIdx !== -1 ? args[profileFlagIdx + 1] : undefined;

  let urls: string[] = [];
  if (inputSource.startsWith("http://") || inputSource.startsWith("https://")) {
    urls = [inputSource];
  } else if (existsSync(inputSource)) {
    urls = readFileSync(inputSource, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"));
  } else {
    console.error(`Error: File or URL not found: ${inputSource}`);
    process.exit(1);
  }

  console.log(`\n=== JEV Job Evaluator ===`);
  console.log(`Target URLs: ${urls.length}`);
  console.log(`Output: ${outFile}`);

  // Resolve profile context
  let profileContext = FALLBACK_PERSONA_CONTEXT;
  let resolvedProfile: any = null;

  if (profileId) {
    try {
      profileContext = await compileMasterProfileContext(profileId);
      resolvedProfile = await db.profile.findUnique({ where: { id: profileId }, include: { user: true } });
      console.log(`Using Master Profile: ${resolvedProfile?.name || profileId}`);
    } catch (err: any) {
      console.warn(`Could not load profile ${profileId}, using fallback persona. Error: ${err.message}`);
    }
  } else {
    try {
      const firstProfile = await db.profile.findFirst({ include: { user: true } });
      if (firstProfile) {
        resolvedProfile = firstProfile;
        profileContext = await compileMasterProfileContext(firstProfile.id);
        console.log(`Using Default Profile from DB: ${firstProfile.name}`);
      } else {
        console.log("No profile in DB. Using built-in test persona.");
      }
    } catch {
      console.log("DB unreachable. Using built-in test persona.");
    }
  }

  console.log("------------------------------------------------------------\n");

  for (const url of urls) {
    const startTime = Date.now();
    console.log(`[JEV] Scraping and evaluating: ${url}`);

    try {
      const scraped = await scrapeJobUrl(url);
      console.log(`  Title: ${scraped.title}`);
      console.log(`  Company: ${scraped.company}`);
      console.log(`  Description length: ${scraped.description.length} chars`);

      const evaluation: EvaluationResult = await evaluateJobFit(scraped, profileContext);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`\n  >> FIT SCORE: ${evaluation.fit_score}/100`);
      console.log(`  >> SUMMARY: ${evaluation.summary}`);
      if (evaluation.deal_breaker_triggered) {
        console.log(`  >> ⚠️ DEAL-BREAKER TRIGGERED: ${evaluation.deal_breaker_reason}`);
      }

      console.log(`  >> PROS (${evaluation.pros.length}):`);
      evaluation.pros.forEach((p) => console.log(`     + ${p}`));

      console.log(`  >> CONS / GAPS (${evaluation.cons.length}):`);
      evaluation.cons.forEach((c) => console.log(`     - ${c}`));

      console.log(`  >> ATS KEYWORDS (${evaluation.keywords.length}):`);
      console.log(`     ${evaluation.keywords.join(", ")}`);
      console.log(`  >> Completed in ${elapsed}s\n`);

      // Persist to DB if connected and profile exists
      if (resolvedProfile) {
        try {
          const posting = await db.jobPosting.upsert({
            where: { id: `posting_${Buffer.from(url).toString("base64").slice(0, 24)}` },
            create: {
              userId: resolvedProfile.userId,
              profileId: resolvedProfile.id,
              url,
              title: scraped.title,
              company: scraped.company,
              location: scraped.location,
              description: scraped.description,
              metadata: {
                evaluatedAt: new Date().toISOString(),
                summary: evaluation.summary,
              },
            },
            update: {
              title: scraped.title,
              company: scraped.company,
              description: scraped.description,
            },
          });

          await db.jobEvaluation.upsert({
            where: { jobPostingId: posting.id },
            create: {
              jobPostingId: posting.id,
              fitScore: evaluation.fit_score,
              pros: evaluation.pros,
              cons: evaluation.cons,
              missingKeywords: evaluation.keywords,
              rubric: {
                dealBreakerTriggered: evaluation.deal_breaker_triggered,
                dealBreakerReason: evaluation.deal_breaker_reason,
                summary: evaluation.summary,
              },
            },
            update: {
              fitScore: evaluation.fit_score,
              pros: evaluation.pros,
              cons: evaluation.cons,
              missingKeywords: evaluation.keywords,
            },
          });

          // Sync skill gaps to learning roadmap
          await syncSkillGapsToLearningGoals(
            { userId: resolvedProfile.userId, profileId: resolvedProfile.id },
            evaluation.cons,
            evaluation.keywords,
          );

          console.log(`  [DB] Saved JobPosting, JobEvaluation, and updated LearningGoals.`);
        } catch (dbErr: any) {
          console.warn(`  [DB] Could not save to DB: ${dbErr.message}`);
        }
      }

      // Write output record to JSONL
      const record = {
        url,
        title: scraped.title,
        company: scraped.company,
        fit_score: evaluation.fit_score,
        pros: evaluation.pros,
        cons: evaluation.cons,
        keywords: evaluation.keywords,
        deal_breaker_triggered: evaluation.deal_breaker_triggered,
        deal_breaker_reason: evaluation.deal_breaker_reason,
        summary: evaluation.summary,
        evaluated_at: new Date().toISOString(),
      };
      appendFileSync(outFile, JSON.stringify(record) + "\n");
    } catch (err: any) {
      console.error(`  [ERROR] Failed to evaluate ${url}: ${err.message}`);
      const errorRecord = {
        url,
        error: err.message,
        evaluated_at: new Date().toISOString(),
      };
      appendFileSync(outFile, JSON.stringify(errorRecord) + "\n");
    }
  }

  await disconnectDatabase();
  console.log(`Evaluation complete. Results written to ${outFile}.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
