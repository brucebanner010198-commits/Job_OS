/**
 * Local model client (Ollama native API).
 *
 * The native /api/chat endpoint is used rather than the OpenAI-compatible one
 * because it accepts a JSON Schema in `format`: generation is constrained to
 * the schema, so small local models cannot return malformed JSON.
 */
import { JobOSError } from "@/lib/errors/job-os-error";

/** Preferred chat models, best first. Anything else installed is a fallback. */
export const PREFERRED_LOCAL_MODELS = ["gemma4:12b", "qwen3.5:9b"];

const EMBEDDING_FAMILIES = ["embed", "bert", "bge", "minilm"];

// Ollama's default context is too small for a resume plus a job description;
// without this, long prompts are silently truncated.
const NUM_CTX = 16_384;
const LOCAL_TIMEOUT_MS = 180_000;
const MODEL_CACHE_MS = 60_000;

let modelCache: { baseUrl: string; at: number; names: string[] } | null = null;

export async function listLocalModels(baseUrl: string): Promise<string[]> {
  if (modelCache && modelCache.baseUrl === baseUrl && Date.now() - modelCache.at < MODEL_CACHE_MS) {
    return modelCache.names;
  }
  const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(1500) });
  if (!res.ok) throw new Error(`Ollama /api/tags returned ${res.status}`);
  const data = (await res.json()) as { models?: { name: string }[] };
  const names = (data.models ?? []).map((m) => m.name);
  modelCache = { baseUrl, at: Date.now(), names };
  return names;
}

export function isEmbeddingModel(name: string): boolean {
  const lower = name.toLowerCase();
  return EMBEDDING_FAMILIES.some((f) => lower.includes(f));
}

function matches(installed: string, wanted: string): boolean {
  return installed === wanted || installed === `${wanted}:latest`;
}

/**
 * Chooses the chat model to use: the user's pick if it is installed,
 * otherwise the best preferred model, otherwise any installed chat model.
 */
export function pickLocalModel(installed: string[], configured?: string): string | null {
  if (configured) {
    const hit = installed.find((m) => matches(m, configured));
    if (hit) return hit;
  }
  for (const wanted of PREFERRED_LOCAL_MODELS) {
    const hit = installed.find((m) => matches(m, wanted));
    if (hit) return hit;
  }
  return installed.find((m) => !isEmbeddingModel(m)) ?? null;
}

export async function resolveLocalModel(baseUrl: string, configured?: string): Promise<string> {
  let installed: string[];
  try {
    installed = await listLocalModels(baseUrl);
  } catch {
    throw JobOSError.failedPrecondition({
      domain: "job_os.ai",
      reason: "LOCAL_AI_OFFLINE",
      location: "lib/ai/local.ts:resolveLocalModel",
      message: "The local AI engine (Ollama) is not running.",
      remedy: "Start Ollama (open the Ollama app, or run `ollama serve`), then try again.",
    });
  }
  const model = pickLocalModel(installed, configured);
  if (!model) {
    throw JobOSError.failedPrecondition({
      domain: "job_os.ai",
      reason: "LOCAL_MODEL_MISSING",
      location: "lib/ai/local.ts:resolveLocalModel",
      message: "Ollama is running but has no chat model installed.",
      remedy: `Install one with \`ollama pull ${PREFERRED_LOCAL_MODELS[0]}\`.`,
    });
  }
  return model;
}

export interface LocalChatInput {
  baseUrl: string;
  model: string;
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
  /** A JSON Schema constrains output exactly; `true` only forces valid JSON. */
  format?: Record<string, unknown> | true;
  signal?: AbortSignal;
}

export interface LocalChatOutput {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
}

export async function chatLocal(input: LocalChatInput): Promise<LocalChatOutput> {
  const body = {
    model: input.model,
    messages: input.messages,
    stream: false,
    // Hidden reasoning roughly triples latency for extraction and rewriting
    // tasks without a measurable quality gain on them.
    think: false,
    ...(input.format ? { format: input.format === true ? "json" : input.format } : {}),
    options: {
      temperature: input.temperature ?? 0.3,
      num_ctx: NUM_CTX,
      ...(input.maxTokens ? { num_predict: input.maxTokens } : {}),
    },
  };

  const timeout = AbortSignal.timeout(LOCAL_TIMEOUT_MS);
  const res = await fetch(`${input.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: input.signal ? AbortSignal.any([input.signal, timeout]) : timeout,
  });

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new JobOSError({
      code: res.status === 404 ? "NOT_FOUND" : "UNAVAILABLE",
      domain: "job_os.ai",
      reason: "LOCAL_AI_ERROR",
      location: "lib/ai/local.ts:chatLocal",
      message: `Local model ${input.model} failed (${res.status}): ${detail || "no detail"}`,
      remedy: "Check that Ollama is running and the model is installed (`ollama list`).",
      metadata: { provider: "ollama", model: input.model, statusCode: res.status },
    });
  }

  const data = (await res.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  return {
    text: data.message?.content ?? "",
    promptTokens: data.prompt_eval_count,
    completionTokens: data.eval_count,
  };
}
