/**
 * OpenRouter embedding API - single entry for text → vector.
 * Used by the pgvector relevance scorer; falls back gracefully when no key.
 */
import { getSecret } from "@/lib/secrets";

const BASE_URL = "https://openrouter.ai/api/v1";

export const EMBEDDING_DIM = 1536;

function embeddingModel(): string {
  return process.env.EMBEDDING_MODEL?.trim() || "openai/text-embedding-3-small";
}

export function embeddingsEnabled(): boolean {
  if (process.env.SCORING_MODE === "lexical") return false;
  return true;
}

/**
 * Embed a text blob via OpenRouter. Returns null when unconfigured or on error.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return null;

  let apiKey: string | undefined;
  try {
    apiKey = await getSecret("OPENROUTER_API_KEY");
  } catch {
    return null;
  }
  if (!apiKey) return null;

  const enforceZdr = process.env.OPENROUTER_ENFORCE_ZDR !== "0";

  try {
    const res = await fetch(`${BASE_URL}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
        "X-Title": "Job OS",
      },
      body: JSON.stringify({
        model: embeddingModel(),
        input: trimmed,
        ...(enforceZdr
          ? { provider: { zdr: true, data_collection: "deny" } }
          : {}),
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { embedding?: number[] }[];
    };
    const vec = json.data?.[0]?.embedding;
    if (!vec || vec.length === 0) return null;
    return vec;
  } catch {
    return null;
  }
}

/** Cosine similarity in [0, 1] from two same-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  // Map [-1, 1] → [0, 1] for scoring parity with lexical overlap.
  return Math.max(0, Math.min(1, (sim + 1) / 2));
}
