import { z } from "zod";
import { chatJson } from "@/lib/ai/openrouter";
import type { WorkCategory } from "@/lib/journal/types";

export const coachingSessionInsightsSchema = z.object({
  title: z.string(),
  summary: z.string(),
  category: z.enum([
    "FEATURE",
    "BUGFIX",
    "ARCHITECTURE",
    "LEADERSHIP",
    "PROCESS",
    "LEARNING",
  ]),
  achievements: z.array(
    z.object({
      description: z.string(),
      metric: z.string().optional(),
      impact: z.string().optional(),
    }),
  ),
  technicalDecisions: z.array(z.string()),
  skills: z.array(z.string()),
  coachingNotes: z.array(z.string()),
  actionItems: z.array(z.string()),
});

export type CoachingSessionInsights = z.infer<typeof coachingSessionInsightsSchema>;

const SYSTEM_PROMPT = `You are an expert career coach and engineering director analyzing a daily audio check-in/coaching session transcript.
Analyze the user's spoken update and extract structured insights:
1. title: A concise, impactful title for today's accomplishments (e.g., "Shipped Go Payments Rewrite with 25% Error Reduction").
2. summary: A 2-3 sentence overview of what was worked on, key context, and progress.
3. category: The primary category of the work (FEATURE, BUGFIX, ARCHITECTURE, LEADERSHIP, PROCESS, LEARNING).
4. achievements: Tangible accomplishments mentioned. Include quantifiable metrics and real-world impact where stated. Never invent metrics.
5. technicalDecisions: Architectural choices, trade-offs, or engineering principles discussed.
6. skills: Specific technologies, tools, or domain concepts practiced or learned today.
7. coachingNotes: Constructive coach observations, strengths demonstrated, and suggestions on how to position this work for career growth.
8. actionItems: Concrete, high-priority follow-up tasks for tomorrow.

Be strictly grounded in the transcript text. Never invent employers, numbers, or facts not mentioned by the user.`;

/**
 * Heuristic fallback parser that extracts structured coaching insights
 * when AI providers are offline or not configured.
 */
export function extractCoachingSessionHeuristic(transcript: string): CoachingSessionInsights {
  const clean = transcript.trim();
  const sentences = clean
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const title = sentences[0]
    ? sentences[0].slice(0, 70)
    : "Daily Coaching Session";

  const summary = sentences.slice(0, 3).join(". ") + (sentences.length > 0 ? "." : "");

  // Detect category from keywords
  let category: WorkCategory = "FEATURE";
  const lower = clean.toLowerCase();
  if (lower.includes("architect") || lower.includes("design") || lower.includes("rfc") || lower.includes("system")) {
    category = "ARCHITECTURE";
  } else if (lower.includes("fix") || lower.includes("bug") || lower.includes("incident") || lower.includes("resolved")) {
    category = "BUGFIX";
  } else if (lower.includes("team") || lower.includes("mentor") || lower.includes("hiring") || lower.includes("led")) {
    category = "LEADERSHIP";
  } else if (lower.includes("learn") || lower.includes("read") || lower.includes("course") || lower.includes("study")) {
    category = "LEARNING";
  } else if (lower.includes("ci/cd") || lower.includes("process") || lower.includes("deploy") || lower.includes("pipeline")) {
    category = "PROCESS";
  }

  // Extract achievements (look for metrics and action verbs)
  const achievements: CoachingSessionInsights["achievements"] = [];

  for (const s of sentences) {
    if (/\b(?:built|shipped|created|implemented|optimized|cut|reduced|increased|improved|delivered)\b/i.test(s)) {
      // Find percentages or currency first
      const specialMetric = s.match(/(\d+(?:\.\d+)?%|\$\d+(?:\.\d+)?[kmbt]?|\b\d+[xX]\b)/i);
      const match = specialMetric || s.match(/\b\d+\b/);
      achievements.push({
        description: s,
        metric: match ? match[0] : undefined,
        impact: match ? `Demonstrated ${match[0]} quantifiable impact` : undefined,
      });
    }
  }

  if (achievements.length === 0 && sentences.length > 0) {
    achievements.push({
      description: sentences[0],
    });
  }

  // Extract decisions
  const technicalDecisions: string[] = [];
  for (const s of sentences) {
    if (/\b(?:decided|chose|trade-off|architecture|migrated|refactored|selected)\b/i.test(s)) {
      technicalDecisions.push(s);
    }
  }

  // Common tech keywords for skills
  const COMMON_SKILLS = [
    "Go", "Golang", "TypeScript", "JavaScript", "Python", "Rust", "React", "Next.js",
    "Postgres", "PostgreSQL", "MySQL", "Redis", "Kafka", "Docker", "Kubernetes",
    "AWS", "GCP", "Azure", "GraphQL", "REST", "CI/CD", "Terraform", "Tailwind",
    "Node.js", "Prisma", "Distributed Systems", "Microservices"
  ];
  const foundSkills: string[] = [];
  for (const sk of COMMON_SKILLS) {
    const re = new RegExp(`\\b${sk}\\b`, "i");
    if (re.test(clean)) {
      foundSkills.push(sk);
    }
  }

  // Coaching notes & action items
  const coachingNotes = [
    "Strong ownership shown in daily session delivery.",
    "Ensure all metric deltas are recorded in your master CV for future job applications.",
  ];

  const actionItems: string[] = [];
  for (const s of sentences) {
    if (/\b(?:tomorrow|next step|need to|will follow up|plan to|todo)\b/i.test(s)) {
      actionItems.push(s);
    }
  }
  if (actionItems.length === 0) {
    actionItems.push("Document technical trade-offs and update career journal.");
  }

  return {
    title,
    summary,
    category,
    achievements,
    technicalDecisions: technicalDecisions.length > 0 ? technicalDecisions : ["Documented ongoing technical choices."],
    skills: Array.from(new Set(foundSkills)),
    coachingNotes,
    actionItems,
  };
}

/**
 * Process a daily coaching voice transcript with the configured LLM,
 * falling back to heuristic parsing if offline or unauthenticated.
 */
export async function extractCoachingSessionInsights(transcript: string): Promise<CoachingSessionInsights> {
  const text = transcript.trim();
  if (!text) {
    throw new Error("Cannot process an empty transcript.");
  }

  try {
    const { value } = await chatJson(coachingSessionInsightsSchema, {
      tier: "standard",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
    });
    return value;
  } catch (err) {
    console.warn("AI session synthesis failed, using heuristic extraction:", err);
    return extractCoachingSessionHeuristic(text);
  }
}
