import { z } from "zod";
import { getSecret } from "@/lib/secrets";
import { MODELS, type ModelTier, type TaskName, modelForTask } from "./models";

const BASE_URL = "https://openrouter.ai/api/v1";

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

function resolveModel(opts: ChatOptions): string {
  if (opts.model) return opts.model;
  if (opts.task) return modelForTask(opts.task);
  return MODELS[opts.tier ?? "standard"];
}

/**
 * Single entry point for OpenRouter chat completions.
 * Enforces zero-data-retention routing (no provider training/logging) and
 * never enables prompt logging.
 */
export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const apiKey = await getSecret("OPENROUTER_API_KEY");
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env (dev) or the OS keychain (packaged build).",
    );
  }

  const model = resolveModel(opts);
  const enforceZdr = process.env.OPENROUTER_ENFORCE_ZDR !== "0";

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    ...(enforceZdr
      ? { provider: { zdr: true, data_collection: "deny" } }
      : {}),
  };

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
      "X-Title": "Job OS",
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status} (${model}): ${detail.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: ChatUsage;
  };

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model,
    usage: data.usage,
  };
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
