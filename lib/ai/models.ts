/**
 * Model routing. Cheap by default; strong only where quality IS the product.
 * Costs are the real levers: route cheap, cache aggressively, batch nightly.
 */
export type ModelTier = "cheap" | "standard" | "strong";

export const MODELS: Record<ModelTier, string> = {
  // parse / extract / classify / dedupe
  cheap: process.env.MODEL_CHEAP ?? "google/gemini-2.5-flash-lite",
  // company briefs, goal elicitation
  standard: process.env.MODEL_STANDARD ?? "google/gemini-2.5-flash",
  // resume tailoring, cover letters, interview brain
  strong: process.env.MODEL_STRONG ?? "anthropic/claude-sonnet-4.6",
};

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "openai/text-embedding-3-small";

/** Task → tier map. Keep this the single source of truth for routing. */
export const TASK_TIER = {
  parseResume: "cheap",
  extractProfile: "cheap",
  classifyEmail: "cheap",
  dedupeJob: "cheap",
  knockoutCheck: "cheap",
  companyBrief: "standard",
  careerGoals: "standard",
  scoreExplain: "standard",
  tailorResume: "strong",
  coverLetter: "strong",
  interviewBrain: "strong",
  provenanceAudit: "standard",
  polishProfileBullets: "standard",
  onboardingCoaching: "standard",
} as const satisfies Record<string, ModelTier>;

export type TaskName = keyof typeof TASK_TIER;

export function tierForTask(task: TaskName): ModelTier {
  return TASK_TIER[task];
}

export function modelForTask(task: TaskName): string {
  return MODELS[tierForTask(task)];
}
