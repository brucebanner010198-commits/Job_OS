"use server";

import { getSecret, setSecret } from "@/lib/secrets";
import { normalizeLocalBaseUrl } from "@/lib/ai/settings";
import { revalidatePath } from "next/cache";

import { requireAccessForMutation, requireAccessForRead } from "@/lib/auth/require-access";

export interface LlmConfigState {
  modelPreference: "local" | "paid" | "both";
  defaultTier: "local" | "paid";
  ollamaUrl: string;
  openaiKeyConfigured: boolean;
  anthropicKeyConfigured: boolean;
  geminiKeyConfigured: boolean;
  openrouterKeyConfigured: boolean;
}

export async function getLlmConfigAction(): Promise<LlmConfigState> {
  await requireAccessForRead();
  const modelPreference = ((await getSecret("AI_MODEL_PREFERENCE")) as "local" | "paid" | "both") || "both";
  const defaultTier = ((await getSecret("AI_DEFAULT_TIER")) as "local" | "paid") || "local";
  const ollamaUrl = normalizeLocalBaseUrl(await getSecret("OLLAMA_BASE_URL"));

  const openaiKey = await getSecret("OPENAI_API_KEY");
  const anthropicKey = await getSecret("ANTHROPIC_API_KEY");
  const geminiKey = await getSecret("GEMINI_API_KEY");
  const openrouterKey = await getSecret("OPENROUTER_API_KEY");

  return {
    modelPreference,
    defaultTier,
    ollamaUrl,
    openaiKeyConfigured: Boolean(openaiKey?.trim()),
    anthropicKeyConfigured: Boolean(anthropicKey?.trim()),
    geminiKeyConfigured: Boolean(geminiKey?.trim()),
    openrouterKeyConfigured: Boolean(openrouterKey?.trim()),
  };
}

export async function saveLlmConfigAction(input: {
  modelPreference: "local" | "paid" | "both";
  defaultTier: "local" | "paid";
  ollamaUrl?: string;
  apiKey?: { provider: "openai" | "anthropic" | "gemini" | "openrouter"; key: string };
}): Promise<{ success: boolean; message: string }> {
  await requireAccessForMutation();
  await setSecret("AI_MODEL_PREFERENCE", input.modelPreference);
  await setSecret("AI_DEFAULT_TIER", input.defaultTier);

  if (input.ollamaUrl?.trim()) {
    await setSecret("OLLAMA_BASE_URL", normalizeLocalBaseUrl(input.ollamaUrl));
  }

  if (input.apiKey && input.apiKey.key.trim()) {
    const keyMap = {
      openai: "OPENAI_API_KEY",
      anthropic: "ANTHROPIC_API_KEY",
      gemini: "GEMINI_API_KEY",
      openrouter: "OPENROUTER_API_KEY",
    };
    await setSecret(keyMap[input.apiKey.provider], input.apiKey.key.trim());
  }

  revalidatePath("/setup");
  return { success: true, message: "LLM configuration saved." };
}

export async function probeLocalLlmAction(url?: string): Promise<{
  online: boolean;
  models: string[];
}> {
  await requireAccessForRead();
  try {
    const cleanUrl = normalizeLocalBaseUrl(url);
    const res = await fetch(`${cleanUrl}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return { online: false, models: [] };
    const data = (await res.json()) as { models?: { name: string }[] };
    const models = (data.models ?? []).map((m) => m.name);
    return { online: true, models };
  } catch {
    return { online: false, models: [] };
  }
}
