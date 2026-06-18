/**
 * SEC-17: Neutralize common LLM role/delimiter injection markers in untrusted
 * text (job descriptions, scraped pages) before embedding in prompts.
 *
 * Strategy: rewrite delimiter-like patterns into bracketed literals so meaning
 * is preserved for ATS/entailment while breaking prompt-structure escapes.
 */

const ROLE_LINE =
  /^(?:#{1,6}\s*)?(system|user|assistant|human|ai)\s*:?\s*$/gim;

const XML_ROLE_TAG =
  /<\/?\s*(system|user|assistant|instructions?|prompt|im_start|im_end)\s*>/gi;

const BRACKET_MARKERS = /\[(?:INST|\/INST|SYS|\/SYS)\]/gi;

const ANGLE_MARKERS = /<<\/?\s*(?:SYS|system|user|assistant)\s*>>/gi;

const CHATML = /<\|im_start\|>|<\|im_end\|>/gi;

const PROMPT_SECTION =
  /^(?:={3,}|-{3,})\s*(system|user|assistant|instructions?|job\s*description)\s*(?:={3,}|-{3,})\s*$/gim;

const FENCED_ROLE_BLOCK =
  /```\s*(system|user|assistant|instructions?)\b/gi;

function bracketNeutral(match: string): string {
  const inner = match.replace(/[<>\[\]|/\\`]/g, "").trim();
  return inner ? `[${inner}]` : "[]";
}

/** Strip/neutralize delimiter injection patterns in untrusted prompt text. */
export function sanitizePromptText(text: string): string {
  if (!text) return "";

  let out = text;
  out = out.replace(ROLE_LINE, (_, role: string) => `[${role.toLowerCase()}]`);
  out = out.replace(XML_ROLE_TAG, bracketNeutral);
  out = out.replace(BRACKET_MARKERS, bracketNeutral);
  out = out.replace(ANGLE_MARKERS, bracketNeutral);
  out = out.replace(CHATML, bracketNeutral);
  out = out.replace(PROMPT_SECTION, (_, section: string) => `[${section.toLowerCase()}]`);
  out = out.replace(FENCED_ROLE_BLOCK, (_, role: string) => `\`\`\`[${role.toLowerCase()}]`);
  return out;
}

const JOB_TEXT_BEGIN = "<<<UNTRUSTED_JOB_TEXT>>>";
const JOB_TEXT_END = "<<<END_UNTRUSTED_JOB_TEXT>>>";

/** Sanitize and fence a job description block inside a user prompt. */
export function wrapJobDescriptionForPrompt(jobDescription: string): string {
  const safe = sanitizePromptText(jobDescription);
  return `${JOB_TEXT_BEGIN}\n${safe}\n${JOB_TEXT_END}`;
}
