/**
 * Public chat entry points. Every model call in the app goes through `chat`
 * or `chatJson`, which delegate to the privacy-aware dispatcher in
 * ./providers.ts. (The file name predates local-first routing.)
 */
import { z } from "zod";
import type { ChatOptions, ChatResult, ChatUsage } from "./providers";

export type { ChatMessage, ChatOptions, ChatResult, ChatUsage } from "./providers";

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const { universalChat } = await import("./providers");
  return universalChat(opts);
}

/** Zod schemas with transforms cannot be expressed as JSON Schema; those fall back to plain JSON mode. */
function toJsonSchema(schema: z.ZodType): Record<string, unknown> | undefined {
  try {
    return z.toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/**
 * Chat that returns JSON validated against a zod schema. Local models are
 * constrained to the schema during generation; cloud replies are validated and
 * retried once with a corrective nudge.
 */
export async function chatJson<T>(
  schema: z.ZodType<T>,
  opts: ChatOptions,
): Promise<{ value: T; model: string; usage?: ChatUsage }> {
  const jsonSchema = toJsonSchema(schema);
  const messages = [...opts.messages];
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await chat({ ...opts, json: true, jsonSchema, messages });
    try {
      const parsed = schema.parse(JSON.parse(result.text));
      return { value: parsed, model: result.model, usage: result.usage };
    } catch (err) {
      if (attempt === 1) {
        throw new Error(`Model did not return schema-valid JSON: ${(err as Error).message}`);
      }
      messages.push({ role: "assistant", content: result.text });
      messages.push({
        role: "user",
        content:
          "That was not valid JSON for the required schema. Return ONLY the corrected JSON object, no prose.",
      });
    }
  }
  throw new Error("chatJson exhausted retries");
}
