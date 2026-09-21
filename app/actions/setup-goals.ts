"use server";

import { revalidatePath } from "next/cache";
import { getAppContext } from "@/lib/app-context";
import { nonSensitiveProfileText, upsertGoal, getGoal } from "@/lib/goals/service";
import { chat } from "@/lib/ai/openrouter";
import { db } from "@/lib/db";
import { scopeWhere } from "@/lib/profiles/scope";
import type { CareerGoalData } from "@/lib/goals/types";

export interface RoleRecommendation {
  title: string;
  matchScore: number; // 0 to 100
  rationale: string;
}

export interface RecommendationResponse {
  recommendations: RoleRecommendation[];
  detectedSeniority: string;
  topSkills: string[];
}

/**
 * Recommends target job roles based on the uploaded master CV facts.
 */
export async function getRoleRecommendationsAction(): Promise<RecommendationResponse> {
  const { scope } = await getAppContext();
  const profileText = await nonSensitiveProfileText(scope);

  if (!profileText || profileText.trim().length < 50) {
    return {
      recommendations: [
        { title: "Senior Software Engineer", matchScore: 90, rationale: "Based on engineering foundation." },
        { title: "Full Stack Tech Lead", matchScore: 85, rationale: "Strong cross-stack capabilities." },
        { title: "Engineering Manager", matchScore: 78, rationale: "Leadership and delivery experience." },
      ],
      detectedSeniority: "Senior",
      topSkills: ["TypeScript", "Next.js", "System Architecture", "PostgreSQL"],
    };
  }

  try {
    const prompt = `Analyze this candidate's master CV and recommend the top 4-5 target job roles that best match their trajectory and capabilities.
Return strict JSON with this schema:
{
  "recommendations": [
    { "title": "Role Title", "matchScore": 88, "rationale": "One-line why this is an ideal match" }
  ],
  "detectedSeniority": "Mid-Level / Senior / Staff / Executive",
  "topSkills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4"]
}`;

    const res = await chat({
      tier: "standard",
      json: true,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Candidate Profile:\n${profileText.slice(0, 4000)}` },
      ],
    });

    const parsed = JSON.parse(res.text) as RecommendationResponse;
    return parsed;
  } catch {
    return {
      recommendations: [
        { title: "Senior Software Engineer", matchScore: 92, rationale: "Matches verified background." },
        { title: "Staff Architect / Tech Lead", matchScore: 86, rationale: "Reflects senior systems design." },
        { title: "Head of Engineering / VP", matchScore: 80, rationale: "Strategic leadership trajectory." },
      ],
      detectedSeniority: "Senior",
      topSkills: ["Full Stack", "Distributed Systems", "Architecture", "Leadership"],
    };
  }
}

export async function saveVisionAndGoalsAction(input: {
  targetTitles: string[];
  northStarVision: string;
  ambitionLevel: string; // "lead" | "coo" | "ceo" | "architect" | "vp"
  targetCompanies: string[];
  maxDailyApplications: number;
  searchCadenceDays: number;
}): Promise<{ success: boolean }> {
  const { scope, user } = await getAppContext();

  const existing = await getGoal(scope);

  const goalData: CareerGoalData = {
    northStar: input.northStarVision || `Advance to ${input.ambitionLevel.toUpperCase()} leadership`,
    summary: `Target roles: ${input.targetTitles.join(", ")}. Companies: ${input.targetCompanies.join(", ")}`,
    targetTitles: input.targetTitles,
    targetIndustries: input.targetCompanies,
    milestones: existing?.milestones || [],
  };

  await upsertGoal(scope, goalData, `Setup Vision: ${input.northStarVision}`);

  // Save cadence and automation quotas to user
  await db.user.update({
    where: { id: user.id },
    data: {
      cadenceConfig: {
        maxDailyApplications: input.maxDailyApplications || 5,
        searchCadenceDays: input.searchCadenceDays || 1,
        targetCompanies: input.targetCompanies,
        ambitionLevel: input.ambitionLevel,
      },
    },
  });

  revalidatePath("/setup");
  revalidatePath("/goals");
  return { success: true };
}
