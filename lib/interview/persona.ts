/**
 * Interview persona BRAIN (Phase 8, plan §5, Hardening §B).
 * Pure - no LLM, no DB, no network, no wall-clock reads, no randomness. Given a
 * per-job PrepInput it assembles the two DISTINCT live voice personas plus a
 * minimal non-voice STUDY facilitator. Fully deterministic and unit-testable.
 *
 * The two live modes are deliberately NON-OVERLAPPING so the agents never bleed:
 *   - AI_SCREEN: a robotic, structured first-filter screener (HireVue / Sapia
 *     style). Low warmth, neutral affect, fixed competency questions, no small
 *     talk; binds to ELEVENLABS_AGENT_AI_SCREEN.
 *   - REAL_HR:   a warm, human per-company hiring manager who asks HARD,
 *     multi-angle follow-ups. High warmth; binds to ELEVENLABS_AGENT_REAL_HR.
 *
 * Safety spine (the reason this is its own grounded brain):
 *   - EXTRACTIVE GROUNDING: a persona is grounded ONLY in real prep facts -
 *     company, role, jobDescription, and the candidate's NON-sensitive facts. It
 *     never invents a company, a metric, or an experience.
 *   - SENSITIVE FACTS NEVER LEAVE: any ProfileFact with `sensitive === true` is
 *     filtered out BEFORE grounding, so no sensitive text can reach a name, a
 *     style line, a system prompt, or an opener. Health / family / protected-class
 *     life facts must never be spoken by, or visible to, an interviewer agent.
 *   - STUDY IS TOTAL: buildPersona("STUDY", …) never throws - it returns a
 *     minimal facilitator persona (warmth 0, no real voice) since STUDY has no
 *     paid voice session.
 */

import type {
  AgentPersona,
  InterviewMode,
  PrepInput,
  ProfileFact,
} from "@/lib/interview/types";

/** Warmth knobs (0..1). AI_SCREEN is cold/robotic; REAL_HR is warm/human. */
const AI_SCREEN_WARMTH = 0.15;
const REAL_HR_WARMTH = 0.85;
const STUDY_WARMTH = 0;

/** The two LIVE personas, in fixed order (deterministic, no persona bleed). */
const LIVE_MODES: readonly InterviewMode[] = ["AI_SCREEN", "REAL_HR"] as const;

/** How many non-sensitive facts to surface as interviewer context (focused). */
const MAX_GROUNDING_FACTS = 6;

/** Drop every sensitive fact BEFORE any grounding - defence in depth. */
function nonSensitiveFacts(facts: ProfileFact[]): ProfileFact[] {
  return facts.filter((f) => !f.sensitive);
}

/** The role label, grounded when known, else a neutral fallback. */
function roleLabel(prep: PrepInput): string {
  const role = prep.role?.trim();
  return role ? role : "the role";
}

/**
 * A short, extractive "what the candidate claims" block built ONLY from real,
 * non-sensitive facts - gives the interviewer concrete material to probe without
 * inventing anything. Empty string when there is nothing safe to ground on.
 */
function backgroundBlock(prep: PrepInput): string {
  const facts = nonSensitiveFacts(prep.facts ?? []).slice(0, MAX_GROUNDING_FACTS);
  if (facts.length === 0) return "";
  const bullets = facts.map((f) => `- ${f.text}`).join("\n");
  return (
    `\n\nThe candidate's own background (use only these real points; never ` +
    `invent experience, metrics, or employers):\n${bullets}`
  );
}

/** A grounding header shared by both live system prompts. */
function groundingHeader(prep: PrepInput): string {
  const role = roleLabel(prep);
  const jd = prep.jobDescription?.trim();
  const jdLine = jd ? `\n\nRole description:\n${jd}` : "";
  return (
    `You are interviewing a candidate for ${role} at ${prep.company}.` +
    jdLine +
    backgroundBlock(prep)
  );
}

/** AI_SCREEN - robotic, structured first-filter screener. */
function aiScreenPersona(prep: PrepInput): AgentPersona {
  const role = roleLabel(prep);
  return {
    mode: "AI_SCREEN",
    name: "Automated screener",
    style:
      "Robotic, structured first-filter screener - neutral affect, fixed " +
      "competency questions, no small talk.",
    systemPrompt:
      `${groundingHeader(prep)}\n\n` +
      `You are an AUTOMATED SCREENING interviewer (a HireVue/Sapia-style ` +
      `first filter). Conduct a structured, mechanical screen:\n` +
      `- Ask a FIXED set of competency questions, one at a time, in order.\n` +
      `- Keep a strictly neutral, professional affect. Do NOT make small talk, ` +
      `crack jokes, react emotionally, or offer encouragement.\n` +
      `- Do not improvise rapport-building follow-ups; only ask a brief ` +
      `clarifying question if an answer is non-responsive.\n` +
      `- Stay strictly on the competencies required for ${role} at ` +
      `${prep.company}. Do not discuss anything outside the job.\n` +
      `- Silently evaluate each answer on four axes: clarity, structure, ` +
      `specificity, and fit to the role. Do not reveal scores to the ` +
      `candidate.\n` +
      `Begin only when the candidate is ready, and keep your turns short.`,
    opener:
      `This is an automated screening interview for ${role} at ` +
      `${prep.company}. I will ask a fixed set of questions. Please answer ` +
      `each one clearly and concisely. When you are ready, we will begin.`,
    agentIdEnv: "ELEVENLABS_AGENT_AI_SCREEN",
    warmth: AI_SCREEN_WARMTH,
  };
}

/** REAL_HR - warm, human hiring manager with hard multi-angle follow-ups. */
function realHrPersona(prep: PrepInput): AgentPersona {
  const role = roleLabel(prep);
  return {
    mode: "REAL_HR",
    name: `${prep.company} hiring manager`,
    style:
      "Warm, human hiring manager - builds rapport, then probes with hard, " +
      "multi-angle follow-ups.",
    systemPrompt:
      `${groundingHeader(prep)}\n\n` +
      `You are the HUMAN HIRING MANAGER for ${role} at ${prep.company} - ` +
      `warm, personable, and genuinely curious. Build rapport and put the ` +
      `candidate at ease, but interview RIGOROUSLY:\n` +
      `- For each claim, ask HARD, MULTI-ANGLE follow-ups: push on the ` +
      `trade-offs they weighed, what they would do differently, how they ` +
      `measured impact, and what they personally (vs. the team) owned.\n` +
      `- Probe depth: when an answer stays high-level, ask for the specific ` +
      `decision, the number behind it, and the failure they learned from.\n` +
      `- Tie questions to the realities of ${role} at ${prep.company} and the ` +
      `role description above.\n` +
      `- Ground every probe in what the candidate actually said or in their ` +
      `stated background; never invent details about them or the company.\n` +
      `Stay warm and encouraging in tone even while the questions get harder.`,
    opener:
      `Hi - thanks so much for making the time today! I'm the hiring ` +
      `manager for ${role} here at ${prep.company}, and I'm really looking ` +
      `forward to our conversation. To start, could you tell me a bit about ` +
      `yourself and what drew you to this role?`,
    agentIdEnv: "ELEVENLABS_AGENT_REAL_HR",
    warmth: REAL_HR_WARMTH,
  };
}

/**
 * STUDY - a minimal, NON-voice facilitator. STUDY has no paid voice session, so
 * this exists only to keep buildPersona TOTAL (a single shape for every mode). It
 * binds to the AI_SCREEN agent-id env as an inert default and is never granted.
 */
function studyPersona(prep: PrepInput): AgentPersona {
  const role = roleLabel(prep);
  return {
    mode: "STUDY",
    name: "Study facilitator",
    style: "Offline study facilitator - not a live voice interviewer.",
    systemPrompt:
      `You are a study facilitator helping the candidate rehearse for ` +
      `${role} at ${prep.company}. STUDY mode is offline self-practice with ` +
      `no live voice session; surface likely questions and grounded model ` +
      `answers only.`,
    opener: `Study mode for ${role} at ${prep.company}.`,
    // Inert default - STUDY is never minted into a voice grant.
    agentIdEnv: "ELEVENLABS_AGENT_AI_SCREEN",
    warmth: STUDY_WARMTH,
  };
}

/**
 * Build one persona for a mode. TOTAL: STUDY (and any unknown value) returns the
 * minimal facilitator rather than throwing, so callers never crash on mode.
 */
export function buildPersona(mode: InterviewMode, prep: PrepInput): AgentPersona {
  switch (mode) {
    case "AI_SCREEN":
      return aiScreenPersona(prep);
    case "REAL_HR":
      return realHrPersona(prep);
    case "STUDY":
    default:
      return studyPersona(prep);
  }
}

/**
 * The two LIVE personas in fixed order - [AI_SCREEN, REAL_HR]. STUDY is excluded
 * because it has no voice. Deterministic and never throws.
 */
export function buildPersonas(prep: PrepInput): AgentPersona[] {
  return LIVE_MODES.map((mode) => buildPersona(mode, prep));
}
