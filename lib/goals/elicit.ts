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

function getOfflineSynthesizedGoals(input: {
  note: string;
  profileText: string;
}): CareerGoalData {
  const note = input.note || input.profileText || "Software engineering and career advancement.";
  return {
    northStar: "Build impactful systems, master modern technologies, and lead engineering initiatives.",
    summary: note.slice(0, 300),
    targetTitles: ["Senior Software Engineer", "Tech Lead", "Staff Engineer"],
    targetIndustries: ["Technology", "Software", "Cloud Computing"],
    milestones: [
      { horizon: "SIX_MONTHS", text: "Target high-fit roles and refine core portfolio", metric: "10 target applications", inferred: true },
      { horizon: "ONE_YEAR", text: "Secure offer and excel in key deliverables", metric: "1 accepted offer", inferred: true },
      { horizon: "TWO_YEARS", text: "Drive architectural initiatives and mentor team members", metric: "Lead major system component", inferred: true },
      { horizon: "THREE_YEARS", text: "Expand domain leadership across cross-functional teams", metric: "Staff-level impact", inferred: true },
      { horizon: "FOUR_YEARS", text: "Establish org-wide engineering standards and direction", metric: "Org technical strategy", inferred: true },
      { horizon: "FIVE_YEARS", text: "Lead multi-team engineering programs or department", metric: "Principal/Director scope", inferred: true },
      { horizon: "TEN_YEARS", text: "Reach executive technical or entrepreneurial pinnacle", metric: "Industry impact", inferred: true },
    ],
  };
}

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

  try {
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
  } catch (err) {
    console.warn("[suggestGoalQuestions] LLM unavailable, using default prompts:", err);
    return [
      "Where do you see yourself making the highest impact in the next 1-2 years?",
      "What core technical or leadership skills do you most want to build or leverage next?",
      "What type of team culture, environment, or company scale fits you best?",
      "What is your target 5-10 year career vision or north star?",
    ];
  }
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

  try {
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
  } catch (err) {
    console.warn("[synthesizeGoals] LLM unavailable, using offline structured synthesis:", err);
    return getOfflineSynthesizedGoals(input);
  }
}
