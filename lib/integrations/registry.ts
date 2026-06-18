/**
 * Integration registry - defines every paste-in key / toggle the Integrations
 * portal manages. Status API exposes configured flags only (never values).
 */
import { getSecret } from "@/lib/secrets";

export type IntegrationCategory =
  | "ai"
  | "voice"
  | "email"
  | "jobs"
  | "research"
  | "knowledge";

export interface IntegrationSecretField {
  key: string;
  label: string;
  /** When true the field is masked in the UI. */
  secret: boolean;
  placeholder?: string;
}

export interface IntegrationDef {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  /** Env/portal keys for this integration. */
  fields: IntegrationSecretField[];
  /** Optional toggle env key (1 = enabled). */
  toggleKey?: string;
  docsUrl?: string;
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    description:
      "Primary LLM + embeddings gateway. Required for AI features (briefs, tailoring, scoring).",
    category: "ai",
    fields: [{ key: "OPENROUTER_API_KEY", label: "API key", secret: true }],
    docsUrl: "https://openrouter.ai/keys",
  },
  {
    id: "elevenlabs",
    name: "ElevenLabs ConvAI",
    description:
      "Live voice mocks (AI screener + real HR personas). Leave blank to use the free fixture mock.",
    category: "voice",
    fields: [
      { key: "ELEVENLABS_API_KEY", label: "API key", secret: true },
      {
        key: "ELEVENLABS_AGENT_AI_SCREEN",
        label: "AI screen agent ID",
        secret: false,
      },
      {
        key: "ELEVENLABS_AGENT_REAL_HR",
        label: "Real HR agent ID",
        secret: false,
      },
    ],
    toggleKey: "ELEVENLABS_VOICE_DISABLED",
    docsUrl: "https://elevenlabs.io",
  },
  {
    id: "pipecat",
    name: "Pipecat OSS voice runner",
    description:
      "Optional local Pipecat + Whisper + Kokoro fallback. Set the connect URL of your runner.",
    category: "voice",
    fields: [
      {
        key: "PIPECAT_CONNECT_URL",
        label: "Connect endpoint URL",
        secret: false,
        placeholder: "http://localhost:8765/connect",
      },
      {
        key: "PIPECAT_CONNECT_TOKEN",
        label: "Bearer token (optional)",
        secret: true,
      },
    ],
    toggleKey: "CARTESIA_VOICE_DISABLED",
  },
  {
    id: "gmail",
    name: "Gmail",
    description:
      "Read-only OAuth for tracker sync. Proposes status changes - never auto-applies.",
    category: "email",
    fields: [
      { key: "GMAIL_CLIENT_ID", label: "OAuth client ID", secret: false },
      { key: "GMAIL_CLIENT_SECRET", label: "OAuth client secret", secret: true },
      {
        key: "GMAIL_REDIRECT_URI",
        label: "Redirect URI",
        secret: false,
        placeholder: "http://localhost:3000/api/gmail/callback",
      },
    ],
    toggleKey: "GMAIL_ENABLED",
    docsUrl: "https://console.cloud.google.com",
  },
  {
    id: "jsearch",
    name: "JSearch (RapidAPI)",
    description: "Optional paid job discovery spine. OSS sources work without it.",
    category: "jobs",
    fields: [{ key: "JSEARCH_API_KEY", label: "API key", secret: true }],
  },
  {
    id: "oss-jobs",
    name: "Free job sources",
    description:
      "Remotive, RemoteOK, Arbeitnow, Jobicy public APIs. Enabled by default.",
    category: "jobs",
    fields: [],
    toggleKey: "JOBS_FREE_SOURCES",
  },
  {
    id: "edgar",
    name: "SEC EDGAR",
    description: "US funding data for company briefs. Requires name+email user agent.",
    category: "research",
    fields: [
      {
        key: "SEC_EDGAR_USER_AGENT",
        label: "User-Agent (Name email@domain.com)",
        secret: false,
        placeholder: "Your Name you@example.com",
      },
    ],
  },
  {
    id: "searxng",
    name: "SearXNG (optional)",
    description: "Self-hosted metasearch for web-research brief adapter.",
    category: "research",
    fields: [
      {
        key: "SEARXNG_URL",
        label: "Instance URL",
        secret: false,
        placeholder: "http://localhost:8080",
      },
    ],
  },
  {
    id: "knowledge",
    name: "Knowledge Notebook",
    description:
      "In-app RAG over profile, briefs, and job descriptions for apply + interview.",
    category: "knowledge",
    fields: [],
    toggleKey: "KNOWLEDGE_NOTEBOOK_ENABLED",
  },
];

export function integrationById(id: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

/** True when every required field for the integration has a value. */
export async function integrationConfigured(def: IntegrationDef): Promise<boolean> {
  if (def.fields.length === 0) {
    if (def.toggleKey) {
      const t = await getSecret(def.toggleKey);
      return t !== "0";
    }
    return true;
  }
  const values = await Promise.all(def.fields.map((f) => getSecret(f.key)));
  return values.every((v) => Boolean(v?.trim()));
}

/** Integration enabled (toggle off = disabled). Defaults to enabled when unset. */
export async function integrationEnabled(def: IntegrationDef): Promise<boolean> {
  if (!def.toggleKey) return true;
  const v = await getSecret(def.toggleKey);
  if (def.toggleKey === "ELEVENLABS_VOICE_DISABLED") return v !== "1";
  if (def.toggleKey === "CARTESIA_VOICE_DISABLED") return v !== "1";
  return v !== "0";
}

export interface IntegrationStatus {
  id: string;
  name: string;
  category: IntegrationCategory;
  configured: boolean;
  enabled: boolean;
}

/** Safe status snapshot - never includes secret values. */
export async function allIntegrationStatuses(): Promise<IntegrationStatus[]> {
  return Promise.all(
    INTEGRATIONS.map(async (def) => ({
      id: def.id,
      name: def.name,
      category: def.category,
      configured: await integrationConfigured(def),
      enabled: await integrationEnabled(def),
    })),
  );
}

/** Read a job-source toggle from the registry (oss sources share JOBS_FREE_SOURCES). */
export async function ossJobsEnabled(): Promise<boolean> {
  const v = await getSecret("JOBS_FREE_SOURCES");
  return v !== "0";
}

export async function knowledgeNotebookEnabled(): Promise<boolean> {
  const v = await getSecret("KNOWLEDGE_NOTEBOOK_ENABLED");
  return v !== "0";
}
