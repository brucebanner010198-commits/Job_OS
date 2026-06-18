/**
 * Career-goal elicitation.
 *
 * Two cheap helpers around the LLM:
 *  - suggestGoalQuestions: a handful of tailored prompts to get the user
 *    talking (backward-planning / SMART / Ikigai framing).
 *  - synthesizeGoals: organize what the user actually said into a fixed
 *    north-star plus one milestone per horizon.
 *
 * This is elicitation, not invention: goals are the user's own aspirations, so
 * the model STRUCTURES their words rather than fabricating a career for them.
 * Anything it has to infer to fill a horizon is flagged inferred:true so the UI
 * can show it as a suggestion to confirm, not a fact.
 */
import { z } from "zod";
import { chatJson } from "@/lib/ai/openrouter";
import { HORIZONS, HORIZON_LABEL, type CareerGoalData } from "./types";

const milestoneSchema = z.object({
  horizon: z.enum(HORIZONS),
  text: z.string(),
  metric: z.string().optional(),
  inferred: z.boolean().optional(),
});

const goalDataSchema = z.object({
  northStar: z.string(),
  summary: z.string(),
  targetTitles: z.array(z.string()),
  targetIndustries: z.array(z.string()),
  milestones: z.array(milestoneSchema),
});

const questionsSchema = z.object({ questions: z.array(z.string()) });

const HORIZON_LIST = HORIZONS.map((h) => `${h} (${HORIZON_LABEL[h]})`).join(", ");

/**
 * 4–6 short, specific questions to help the user articulate direction, tailored
 * to their existing profile. Standard tier; these set up synthesizeGoals.
 */
export async function suggestGoalQuestions(
  profileText: string,
): Promise<string[]> {
  const system =
    "You are a thoughtful career coach. Given a snapshot of someone's " +
    "background, ask 4-6 short, concrete questions that help them articulate " +
    "where they want their career to go - using backward-planning from a " +
    "10-year north-star, SMART specifics, and what energizes them (Ikigai). " +
    "Make the questions specific to THIS person's background, not generic. " +
    "One sentence each, no numbering. " +
    'Respond ONLY as JSON: { "questions": ["…", "…"] }.';

  const { value } = await chatJson(questionsSchema, {
    task: "careerGoals",
    temperature: 0.5,
    maxTokens: 500,
    messages: [
      { role: "system", content: system },
      {
        role: "user",
        content: `BACKGROUND (non-sensitive profile):\n${profileText || "(no profile yet)"}`,
      },
    ],
  });
  return value.questions.slice(0, 6);
}

/**
 * Organize the user's free-written / dictated career direction into a fixed
 * north-star plus one milestone per horizon, with the scoring signals
 * (target titles + industries). Standard tier.
 */
export async function synthesizeGoals(input: {
  note: string;
  profileText: string;
}): Promise<CareerGoalData> {
  const system =
    "You turn someone's stated career aspirations into a lightweight, " +
    "structured plan. Work BACKWARD from a fixed 10-year north-star to nearer " +
    "milestones, and make each milestone SMART (specific + measurable where " +
    "possible). " +
    "Ground everything in what the person actually said and their background; " +
    "do NOT invent a career they did not describe. If you must infer a " +
    "milestone to fill a horizon, set inferred:true so it reads as a " +
    "suggestion. " +
    `Provide exactly one milestone for EACH of these horizons: ${HORIZON_LIST}. ` +
    "targetTitles = the concrete roles they're aiming for (e.g. 'Staff " +
    "Engineer', 'Engineering Manager'); targetIndustries = the domains/sectors " +
    "(e.g. 'fintech', 'climate', 'healthcare AI'). Keep summary to one " +
    "paragraph capturing the overall direction. " +
    'Respond ONLY as JSON matching: { "northStar", "summary", "targetTitles": ' +
    '[…], "targetIndustries": […], "milestones": [ { "horizon", "text", ' +
    '"metric"?, "inferred"? } ] }. Use the exact uppercase horizon strings.';

  const user = `THEIR STATED DIRECTION (the source of truth):
${input.note}

THEIR BACKGROUND (non-sensitive, for context only):
${input.profileText || "(no profile yet)"}

Produce the structured career goals JSON now.`;

  const { value } = await chatJson(goalDataSchema, {
    task: "careerGoals",
    temperature: 0.3,
    maxTokens: 1200,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return value;
}
