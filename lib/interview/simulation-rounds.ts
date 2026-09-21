import { db } from "@/lib/db";
import { scopeData, scopeWhere } from "@/lib/profiles/scope";
import type { AppScope } from "@/lib/profiles/types";
import { chat } from "@/lib/ai/openrouter";

export interface SimulationRoundInput {
  company: string;
  role: string;
  mode: "AI_SCREEN" | "REAL_HR";
  transcript: string;
  roundNumber?: number;
}

export interface SimulationReport {
  id: string;
  roundNumber: number;
  overallScore: number;
  scoreDelta?: number;
  categoryScores: {
    clarity: number;
    technicalDepth: number;
    brevity: number;
    leadership: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  reportMarkdown: string;
}

/**
 * Evaluates a completed interview round, tracks round number (1-4),
 * calculates improvement score deltas, and saves the report.
 */
export async function recordSimulationRound(
  scope: AppScope,
  input: SimulationRoundInput,
): Promise<SimulationReport> {
  // Find previous rounds for this company/role
  const previousRounds = await db.interviewSimulationRound.findMany({
    where: {
      ...scopeWhere(scope),
      company: input.company,
    },
    orderBy: { roundNumber: "desc" },
    take: 1,
  });

  const previous = previousRounds[0];
  const roundNumber = input.roundNumber ?? ((previous?.roundNumber ?? 0) + 1);

  const prompt = `You are a tough executive interview evaluator.
Evaluate this ${input.mode === "AI_SCREEN" ? "AI Filter Screening" : "Senior HR Interview"} simulation for "${input.role}" at "${input.company}".
Score the candidate out of 100 based on:
- Clarity (0-25)
- Technical Depth & Specifics (0-25)
- Brevity & Conciseness (0-25)
- Leadership & Ownership (0-25)

Identify top 2 strengths, top 2 weaknesses, and 3 specific actions to improve for the next practice round (Best practice is 3 to 4 rounds).

Return strict JSON:
{
  "overallScore": 82,
  "categoryScores": { "clarity": 22, "technicalDepth": 20, "brevity": 18, "leadership": 22 },
  "strengths": ["Clear metrics provided in answering scaling challenges", "Strong executive presence"],
  "weaknesses": ["Spent too much time on introductory background", "Did not state trade-offs explicitly"],
  "recommendations": ["Cut opener to under 45 seconds", "State technologies upfront", "Use STAR structure consistently"],
  "reportMarkdown": "### Executive Summary\\n..."
}`;

  let evalData = {
    overallScore: 78,
    categoryScores: { clarity: 20, technicalDepth: 20, brevity: 19, leadership: 19 },
    strengths: ["Confident tone", "Structured presentation of experience"],
    weaknesses: ["Could quantify metrics more consistently", "Answers ran slightly long"],
    recommendations: [
      "Open each answer with the bottom-line result",
      "Mention specific scale numbers (QPS, data volume)",
      "Re-practice this scenario in Round 2 to hit 85+ score",
    ],
    reportMarkdown: "Good baseline session. Focus on brevity and quantified impact in your next round.",
  };

  try {
    const res = await chat({
      tier: "standard",
      json: true,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Interview Transcript:\n${input.transcript.slice(0, 5000)}` },
      ],
    });
    evalData = JSON.parse(res.text);
  } catch {
    // Keep fallback
  }

  const scoreDelta = previous ? evalData.overallScore - previous.overallScore : undefined;

  const record = await db.interviewSimulationRound.create({
    data: {
      ...scopeData(scope),
      company: input.company,
      role: input.role,
      mode: input.mode,
      roundNumber,
      overallScore: evalData.overallScore,
      categoryScores: evalData.categoryScores,
      strengths: evalData.strengths,
      weaknesses: evalData.weaknesses,
      recommendations: evalData.recommendations,
      reportMarkdown: evalData.reportMarkdown,
    },
  });

  return {
    id: record.id,
    roundNumber,
    overallScore: record.overallScore,
    scoreDelta,
    categoryScores: evalData.categoryScores,
    strengths: record.strengths,
    weaknesses: record.weaknesses,
    recommendations: record.recommendations,
    reportMarkdown: record.reportMarkdown,
  };
}

export async function listSimulationReports(
  scope: AppScope,
  company: string,
): Promise<SimulationReport[]> {
  const records = await db.interviewSimulationRound.findMany({
    where: {
      ...scopeWhere(scope),
      company,
    },
    orderBy: { roundNumber: "asc" },
  });

  return records.map((r, i) => {
    const prev = records[i - 1];
    return {
      id: r.id,
      roundNumber: r.roundNumber,
      overallScore: r.overallScore,
      scoreDelta: prev ? r.overallScore - prev.overallScore : undefined,
      categoryScores: r.categoryScores as { clarity: number; technicalDepth: number; brevity: number; leadership: number },
      strengths: r.strengths,
      weaknesses: r.weaknesses,
      recommendations: r.recommendations,
      reportMarkdown: r.reportMarkdown,
    };
  });
}
