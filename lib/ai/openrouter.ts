import { z } from "zod";
import type { ModelTier, TaskName } from "./models";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  /** Pick by task (preferred) … */
  task?: TaskName;
  /** … or by tier … */
  tier?: ModelTier;
  /** … or by explicit OpenRouter slug. */
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
}

export interface ChatUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface ChatResult {
  text: string;
  model: string;
  usage?: ChatUsage;
}

/**
 * Single entry point for OpenRouter chat completions.
 * Enforces zero-data-retention routing (no provider training/logging) and
 * never enables prompt logging.
 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const { universalChat } = await import("./providers");
  return universalChat(opts);
}

/**
 * Chat that returns JSON validated against a zod schema. Retries once on a
 * parse/validation miss with a corrective nudge.
 */
export async function chatJson<T>(
  schema: z.ZodType<T>,
  opts: ChatOptions,
): Promise<{ value: T; model: string; usage?: ChatUsage }> {
  const messages = [...opts.messages];
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await chat({ ...opts, json: true, messages });
    try {
      const parsed = schema.parse(JSON.parse(result.text));
      return { value: parsed, model: result.model, usage: result.usage };
    } catch (err) {
      if (attempt === 1) {
        throw new Error(
          `Model did not return schema-valid JSON: ${(err as Error).message}`,
        );
      }
      messages.push({ role: "assistant", content: result.text });
      messages.push({
        role: "user",
        content:
          "That was not valid JSON for the required schema. Return ONLY the corrected JSON object, no prose.",
      });
    }
  }
  // unreachable
  throw new Error("chatJson exhausted retries");
}
