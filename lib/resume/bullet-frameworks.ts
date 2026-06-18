/**
 * Resume bullet frameworks - shared by master-profile extraction and tailored
 * resume generation. Every experience/project bullet must follow exactly one of
 * these formulas; choose based on the facts available, not invented filler.
 */

export type BulletFrameworkCategory =
  | "data-first"
  | "behavioral"
  | "executive";

export type BulletFrameworkId =
  | "xyz"
  | "teal"
  | "apr"
  | "star"
  | "car"
  | "par"
  | "bar"
  | "soar"
  | "lps"
  | "elite";

export interface BulletFramework {
  id: BulletFrameworkId;
  name: string;
  category: BulletFrameworkCategory;
  formula: string;
  when: string;
}

/** All supported bullet frameworks, grouped for prompt construction. */
export const BULLET_FRAMEWORKS: readonly BulletFramework[] = [
  // Data-first - metrics, scale, immediate quantification
  {
    id: "xyz",
    name: "Google X-Y-Z",
    category: "data-first",
    formula: "Accomplished [X] as measured by [Y], by doing [Z].",
    when: "A clear outcome and a verbatim metric both exist in the source facts.",
  },
  {
    id: "teal",
    name: "TEAL",
    category: "data-first",
    formula: "[Result] + [Metric] + [Context].",
    when: "Lead with the headline number or outcome; metric must be in sources.",
  },
  {
    id: "apr",
    name: "APR",
    category: "data-first",
    formula: "[Action] + [Project] + [Result].",
    when: "Project delivery with a concrete completion or measurable result.",
  },
  // Behavioral & storytelling
  {
    id: "star",
    name: "STAR",
    category: "behavioral",
    formula: "[Situation] + [Task] + [Action] + [Result].",
    when: "Full narrative arc: context, responsibility, what you did, outcome.",
  },
  {
    id: "car",
    name: "CAR",
    category: "behavioral",
    formula: "[Challenge] + [Action] + [Result].",
    when: "A specific obstacle or conflict you resolved (streamlined STAR).",
  },
  {
    id: "par",
    name: "PAR",
    category: "behavioral",
    formula: "[Problem] + [Action] + [Result].",
    when: "Technical or operational fix with a clear before/after.",
  },
  {
    id: "bar",
    name: "BAR",
    category: "behavioral",
    formula: "[Background] + [Action] + [Result].",
    when: "High-level context before detailing scope and impact.",
  },
  {
    id: "soar",
    name: "SOAR",
    category: "behavioral",
    formula: "[Situation] + [Obstacle] + [Action] + [Results].",
    when: "Specific blockers or constraints you overcame under pressure.",
  },
  // Executive & competency
  {
    id: "lps",
    name: "LPS",
    category: "executive",
    formula: "[Leadership] + [Problem-solving] + [Strategy].",
    when: "Senior roles: rotate to show executive traits across bullets.",
  },
  {
    id: "elite",
    name: "ELITE",
    category: "executive",
    formula: "[Engage] + [Lead] + [Innovate] + [Transform] + [Execute].",
    when: "Org change, digital transformation, or multi-stakeholder initiatives.",
  },
] as const;

const BY_CATEGORY = {
  "data-first": BULLET_FRAMEWORKS.filter((f) => f.category === "data-first"),
  behavioral: BULLET_FRAMEWORKS.filter((f) => f.category === "behavioral"),
  executive: BULLET_FRAMEWORKS.filter((f) => f.category === "executive"),
} as const;

function formatFrameworkList(frameworks: readonly BulletFramework[]): string {
  return frameworks
    .map((f) => `- ${f.name}: ${f.formula} Use when: ${f.when}`)
    .join("\n");
}

export interface BulletFrameworkPromptOptions {
  /** Influences how often executive frameworks are preferred. */
  seniority?: "student" | "junior" | "mid" | "senior" | "executive";
}

/**
 * Prompt block injected into master extraction and tailored-resume system
 * messages. Requires every bullet to follow one named framework.
 */
export function bulletFrameworkPromptBlock(
  options: BulletFrameworkPromptOptions = {},
): string {
  const senior = options.seniority ?? "mid";
  const preferExecutive =
    senior === "senior" || senior === "executive"
      ? "For this seniority, include at least one LPS or ELITE bullet per role when leadership or transformation facts exist."
      : "Reserve LPS and ELITE for bullets that genuinely show leadership, strategy, or organizational change.";

  return `BULLET FRAMEWORKS (mandatory for every experience and project bullet):
Each bullet MUST follow exactly ONE of these formulas. Weave the parts into one concise sentence (or two short clauses max) - do not label the parts.

1. Data-first (prefer when sources include verbatim metrics or scale):
${formatFrameworkList(BY_CATEGORY["data-first"])}

2. Behavioral & storytelling (obstacles, fixes, pressure, narrative):
${formatFrameworkList(BY_CATEGORY.behavioral)}

3. Executive & competency (strategy, change, senior scope):
${formatFrameworkList(BY_CATEGORY.executive)}

Selection rules:
- Never invent metrics to force a data-first framework; if no number exists in sources, use CAR, PAR, BAR, or STAR instead.
- When metrics exist verbatim in sources, prefer TEAL or X-Y-Z and front-load the result.
- Vary frameworks across bullets in the same role when multiple formulas fit equally.
- ${preferExecutive}
- Output polished resume prose only - no framework names or bracket placeholders in the final bullet text.`;
}
