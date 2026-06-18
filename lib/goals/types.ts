/**
 * Career-goals domain types - DB-decoupled so the elicitation, scoring, and UI
 * layers don't depend on Prisma. Mirrors the CareerGoal row.
 *
 * Kept deliberately lightweight (plan §7): a fixed north-star plus one
 * milestone per horizon, and the small set of fields that actually drive
 * scoring (target titles + industries + a one-paragraph summary).
 */

/** The seven planning horizons, mirrored from Prisma's GoalHorizon enum. */
export const HORIZONS = [
  "SIX_MONTHS",
  "ONE_YEAR",
  "TWO_YEARS",
  "THREE_YEARS",
  "FOUR_YEARS",
  "FIVE_YEARS",
  "TEN_YEARS",
] as const;

export type GoalHorizon = (typeof HORIZONS)[number];

/** Human label for each horizon, in order. */
export const HORIZON_LABEL: Record<GoalHorizon, string> = {
  SIX_MONTHS: "6 months",
  ONE_YEAR: "1 year",
  TWO_YEARS: "2 years",
  THREE_YEARS: "3 years",
  FOUR_YEARS: "4 years",
  FIVE_YEARS: "5 years",
  TEN_YEARS: "10 years",
};

export interface Milestone {
  horizon: GoalHorizon;
  /** What "done" looks like at this horizon. */
  text: string;
  /** Optional measurable marker (e.g. "lead a team of 5", "$160k"). */
  metric?: string;
  /** True when the model inferred this rather than the user stating it. */
  inferred?: boolean;
}

/** DB-decoupled career-goal shape used across elicitation, scoring, and UI. */
export interface CareerGoalData {
  /** The fixed end goal. */
  northStar: string;
  /** One-paragraph synthesized direction - the goal scoring axis. */
  summary: string;
  /** Roles the user is aiming for (strongest scoring signal). */
  targetTitles: string[];
  /** Industries / domains the user is aiming for. */
  targetIndustries: string[];
  /** One milestone per horizon, in HORIZONS order. */
  milestones: Milestone[];
}

/** Order milestones by horizon and fill any missing horizons with blanks. */
export function normalizeMilestones(milestones: Milestone[]): Milestone[] {
  const byHorizon = new Map(milestones.map((m) => [m.horizon, m]));
  return HORIZONS.map(
    (h) => byHorizon.get(h) ?? { horizon: h, text: "" },
  );
}

/**
 * The goal scoring axis: a single text blob the job engine matches against
 * (the "career-goals" side of max(resume, goals) relevance). Target titles and
 * industries are repeated because they're the sharpest signal of direction.
 * Pure - safe to use on the client for the live impact preview.
 */
export function goalText(goal: CareerGoalData): string {
  const titles = goal.targetTitles.join(", ");
  const industries = goal.targetIndustries.join(", ");
  return [
    goal.northStar,
    goal.summary,
    titles,
    titles,
    industries,
    industries,
    goal.milestones
      .map((m) => [m.text, m.metric].filter(Boolean).join(" "))
      .join(" "),
  ]
    .filter(Boolean)
    .join(". ");
}
