import { getSecret } from "@/lib/secrets";
import { MODELS, type ModelTier, type TaskName, modelForTask } from "./models";
import { JobOSError } from "@/lib/errors/job-os-error";
import { HTTP_STATUS_TO_CANONICAL } from "@/lib/errors/canonical-codes";
import { getAiSettings } from "./settings";
import { decideRoute, type CloudProvider } from "./routing";
import { chatLocal, resolveLocalModel } from "./local";
import { recordToLedger, hostOf, byteLength } from "./ledger";
import { scrubPII } from "./redaction";

function createProviderError(options: {
  provider: string;
  model: string;
  status: number;
  detail: string;
  location: string;
}): JobOSError {
  const code = HTTP_STATUS_TO_CANONICAL[options.status] ?? "UNAVAILABLE";
  let remedy = "Check provider status or select a different model in Integrations.";
  if (options.status === 401 || options.status === 403) {
    remedy = `Verify that your ${options.provider} API key is valid in Integrations.`;
  } else if (options.status === 429) {
    remedy = `Rate limit or credits exhausted on ${options.provider}. Check your account quota.`;
  } else if (options.status === 404) {
    remedy = `The requested model (${options.model}) was not found by ${options.provider}. Select an available model in Integrations.`;
  }

  return new JobOSError({
    code,
    domain: "job_os.ai",
    reason: `${options.provider.toUpperCase()}_API_ERROR`,
    location: options.location,
    message: `${options.provider} API error (${options.status}): ${options.detail.slice(0, 300) || "No response text."}`,
    remedy,
    metadata: {
      provider: options.provider,
      model: options.model,
      statusCode: options.status,
    },
  });
}

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
  /** JSON Schema for the reply; local models are constrained to it exactly. */
  jsonSchema?: Record<string, unknown>;
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
 * Single dispatcher for every model call.
 *
 * Privacy rules (see ./routing.ts): private mode always runs locally; enhanced
 * mode sends only consented tasks to the cloud, with contact details scrubbed
 * unless the task needs them. Every call is written to the privacy ledger.
 */
export async function universalChat(opts: ChatOptions): Promise<ChatResult> {
  const settings = await getAiSettings();
  const keys = {
    gemini: await getSecret("GEMINI_API_KEY"),
    openai: await getSecret("OPENAI_API_KEY"),
    anthropic: await getSecret("ANTHROPIC_API_KEY"),
    openrouter: await getSecret("OPENROUTER_API_KEY"),
  };
  const availableCloud = new Set(
    (Object.keys(keys) as CloudProvider[]).filter((p) => Boolean(keys[p]?.trim())),
  );

  const route = decideRoute({
    settings,
    task: opts.task,
    availableCloud,
    requested: opts.provider === "ollama" ? "ollama" : opts.provider,
  });

  if (route.kind === "local") return runLocal(opts, settings.localBaseUrl, settings.localModel);

  const cloudOpts = route.redact
    ? { ...opts, messages: opts.messages.map((m) => ({ ...m, content: scrubPII(m.content) })) }
    : opts;
  const started = Date.now();
  const bytesOut = byteLength(JSON.stringify(cloudOpts.messages));
  try {
    const result = await runCloud(route.provider, cloudOpts, keys[route.provider]!);
    recordToLedger({
      kind: "ai",
      purpose: opts.task ?? "untagged",
      provider: route.provider,
      model: result.model,
      destination: CLOUD_HOSTS[route.provider],
      local: false,
      redacted: route.redact,
      bytesOut,
      bytesIn: byteLength(result.text),
      durationMs: Date.now() - started,
      ok: true,
    });
    return result;
  } catch (err) {
    recordToLedger({
      kind: "ai",
      purpose: opts.task ?? "untagged",
      provider: route.provider,
      destination: CLOUD_HOSTS[route.provider],
      local: false,
      redacted: route.redact,
      bytesOut,
      durationMs: Date.now() - started,
      ok: false,
      errorReason: err instanceof JobOSError ? err.reason : "REQUEST_FAILED",
    });
    // A failed cloud call falls back to the local model rather than failing
    // the feature; nothing further leaves the machine.
    return runLocal(opts, settings.localBaseUrl, settings.localModel);
  }
}

const CLOUD_HOSTS: Record<CloudProvider, string> = {
  gemini: "generativelanguage.googleapis.com",
  openai: "api.openai.com",
  anthropic: "api.anthropic.com",
  openrouter: "openrouter.ai",
};

function runCloud(provider: CloudProvider, opts: ChatOptions, key: string): Promise<ChatResult> {
  switch (provider) {
    case "gemini":
      return chatGemini(opts, key);
    case "openai":
      return chatOpenAI(opts, key);
    case "anthropic":
      return chatAnthropic(opts, key);
    case "openrouter":
      return chatOpenRouter(opts, key);
  }
}

async function runLocal(opts: ChatOptions, baseUrl: string, configured?: string): Promise<ChatResult> {
  const model = await resolveLocalModel(baseUrl, configured);
  const started = Date.now();
  const bytesOut = byteLength(JSON.stringify(opts.messages));
  try {
    const out = await chatLocal({
      baseUrl,
      model,
      messages: opts.messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
      format: opts.jsonSchema ?? (opts.json ? true : undefined),
      signal: opts.signal,
    });
    recordToLedger({
      kind: "ai",
      purpose: opts.task ?? "untagged",
      provider: "ollama",
      model,
      destination: hostOf(baseUrl),
      local: true,
      bytesOut,
      bytesIn: byteLength(out.text),
      durationMs: Date.now() - started,
      ok: true,
    });
    return {
      text: out.text,
      model,
      provider: "ollama",
      usage: {
        prompt_tokens: out.promptTokens,
        completion_tokens: out.completionTokens,
        total_tokens:
          out.promptTokens !== undefined && out.completionTokens !== undefined
            ? out.promptTokens + out.completionTokens
            : undefined,
      },
    };
  } catch (err) {
    recordToLedger({
      kind: "ai",
      purpose: opts.task ?? "untagged",
      provider: "ollama",
      model,
      destination: hostOf(baseUrl),
      local: true,
      bytesOut,
      durationMs: Date.now() - started,
      ok: false,
      errorReason: err instanceof JobOSError ? err.reason : "REQUEST_FAILED",
    });
    throw err;
  }
}

function resolveTimeoutSignal(signal?: AbortSignal, timeoutMs = 45_000): AbortSignal {
  if (signal) {
    if ("any" in AbortSignal && typeof (AbortSignal as unknown as { any?: (signals: AbortSignal[]) => AbortSignal }).any === "function") {
      return (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([
        signal,
        AbortSignal.timeout(timeoutMs),
      ]);
    }
    return signal;
  }
  return AbortSignal.timeout(timeoutMs);
}

async function chatOpenRouter(opts: ChatOptions, apiKey: string): Promise<ChatResult> {
  if (!apiKey) {
    throw JobOSError.failedPrecondition({
      domain: "job_os.ai",
      reason: "MISSING_API_KEY",
      location: "lib/ai/providers.ts:chatOpenRouter",
      message:
        "No AI API key found. Configure OpenRouter, Gemini, OpenAI, Anthropic, or Ollama in Integrations.",
      remedy:
        "Navigate to Integrations (/integrations) and enter an API key for your chosen provider or start a local Ollama instance.",
    });
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
    signal: resolveTimeoutSignal(opts.signal),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw createProviderError({
      provider: "OpenRouter",
      model,
      status: res.status,
      detail,
      location: "lib/ai/providers.ts:chatOpenRouter",
    });
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
    signal: resolveTimeoutSignal(opts.signal),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw createProviderError({
      provider: "OpenAI",
      model,
      status: res.status,
      detail,
      location: "lib/ai/providers.ts:chatOpenAI",
    });
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
  // 2.5 models are restricted for new Google projects; 3.x Flash is the current stable line.
  const model =
    opts.model && !opts.model.includes("/")
      ? opts.model
      : (await getSecret("GEMINI_MODEL")) || (opts.tier === "cheap" ? "gemini-3.5-flash-lite" : "gemini-3.8-flash");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Format messages into Google Generative AI shape
  const contents = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const systemMessage = opts.messages.find((m) => m.role === "system");
  const systemInstruction = systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined;

  const res = await fetch(url, {
    method: "POST",
    // Header rather than ?key= so the key never lands in URL logs.
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: {
        temperature: opts.temperature ?? 0.3,
        ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
        ...(opts.json ? { responseMimeType: "application/json" } : {}),
      },
    }),
    signal: resolveTimeoutSignal(opts.signal),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw createProviderError({
      provider: "Gemini",
      model,
      status: res.status,
      detail,
      location: "lib/ai/providers.ts:chatGemini",
    });
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
    signal: resolveTimeoutSignal(opts.signal),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw createProviderError({
      provider: "Anthropic",
      model,
      status: res.status,
      detail,
      location: "lib/ai/providers.ts:chatAnthropic",
    });
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "";

  return {
    text,
    model,
    provider: "anthropic",
  };
}
