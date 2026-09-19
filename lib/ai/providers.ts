import { getSecret } from "@/lib/secrets";
import { MODELS, type ModelTier, type TaskName, modelForTask } from "./models";

export type ProviderKind = "openrouter" | "ollama" | "openai" | "anthropic" | "gemini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  task?: TaskName;
  tier?: ModelTier;
  model?: string;
  provider?: ProviderKind;
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
  provider: string;
  usage?: ChatUsage;
}

function resolveModel(opts: ChatOptions): string {
  if (opts.model) return opts.model;
  if (opts.task) return modelForTask(opts.task);
  return MODELS[opts.tier ?? "standard"];
}

/**
 * Universal chat dispatcher:
 * Automatically uses the active provider based on configured keys:
 * 1. Explicit opts.provider if given
 * 2. Local Ollama if OLLAMA_BASE_URL or LOCAL_AI_ENABLED is set
 * 3. GEMINI_API_KEY if configured
 * 4. OPENAI_API_KEY if configured
 * 5. ANTHROPIC_API_KEY if configured
 * 6. OPENROUTER_API_KEY fallback
 */
export async function universalChat(opts: ChatOptions): Promise<ChatResult> {
  const localUrl = (await getSecret("OLLAMA_BASE_URL")) || process.env.OLLAMA_BASE_URL;
  const geminiKey = (await getSecret("GEMINI_API_KEY")) || process.env.GEMINI_API_KEY;
  const openaiKey = (await getSecret("OPENAI_API_KEY")) || process.env.OPENAI_API_KEY;
  const anthropicKey = (await getSecret("ANTHROPIC_API_KEY")) || process.env.ANTHROPIC_API_KEY;
  const openrouterKey = (await getSecret("OPENROUTER_API_KEY")) || process.env.OPENROUTER_API_KEY;

  const targetProvider = opts.provider ?? (
    localUrl ? "ollama" :
    geminiKey ? "gemini" :
    openaiKey ? "openai" :
    anthropicKey ? "anthropic" :
    "openrouter"
  );

  if (targetProvider === "ollama" || (localUrl && !opts.provider)) {
    return chatOllama(opts, localUrl ?? "http://localhost:11434/v1");
  }

  if (targetProvider === "gemini" && geminiKey) {
    return chatGemini(opts, geminiKey);
  }

  if (targetProvider === "openai" && openaiKey) {
    return chatOpenAI(opts, openaiKey);
  }

  if (targetProvider === "anthropic" && anthropicKey) {
    return chatAnthropic(opts, anthropicKey);
  }

  return chatOpenRouter(opts, openrouterKey ?? "");
}

async function chatOllama(opts: ChatOptions, baseUrl: string): Promise<ChatResult> {
  const model = opts.model ?? process.env.LOCAL_MODEL_NAME ?? "llama3.2";
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Local Ollama error (${res.status}): ${detail.slice(0, 400)}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model,
    provider: "ollama",
    usage: data.usage,
  };
}

async function chatOpenRouter(opts: ChatOptions, apiKey: string): Promise<ChatResult> {
  if (!apiKey) {
    throw new Error("No AI API key found. Configure OpenRouter, Gemini, OpenAI, Anthropic, or Ollama in Integrations.");
  }

  const model = resolveModel(opts);
  const enforceZdr = process.env.OPENROUTER_ENFORCE_ZDR !== "0";

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    ...(enforceZdr ? { provider: { zdr: true, data_collection: "deny" } } : {}),
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model,
    provider: "openrouter",
    usage: data.usage,
  };
}

async function chatOpenAI(opts: ChatOptions, apiKey: string): Promise<ChatResult> {
  const model = opts.model ?? (opts.tier === "strong" ? "gpt-4o" : "gpt-4o-mini");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.3,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    model,
    provider: "openai",
    usage: data.usage,
  };
}

async function chatGemini(opts: ChatOptions, apiKey: string): Promise<ChatResult> {
  const model = opts.model ?? (opts.tier === "strong" ? "gemini-2.5-pro" : "gemini-2.5-flash");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Format messages into Google Generative AI shape
  const contents = opts.messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const systemMessage = opts.messages.find((m) => m.role === "system");
  const systemInstruction = systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: contents.filter((c) => c.role !== "system"),
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  return {
    text,
    model,
    provider: "gemini",
  };
}

async function chatAnthropic(opts: ChatOptions, apiKey: string): Promise<ChatResult> {
  const model = opts.model ?? (opts.tier === "strong" ? "claude-3-5-sonnet-latest" : "claude-3-5-haiku-latest");
  const systemMessage = opts.messages.find((m) => m.role === "system")?.content;
  const nonSystemMessages = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: nonSystemMessages,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.3,
      ...(systemMessage ? { system: systemMessage } : {}),
    }),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  return {
    text,
    model,
    provider: "anthropic",
  };
}
