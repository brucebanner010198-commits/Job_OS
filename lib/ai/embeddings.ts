/**
 * Text → vector, always on this machine (Ollama + nomic-embed-text).
 *
 * Embeddings are cheap to compute locally and are never worth sending your
 * resume or journal to a cloud API, so this module has no cloud path in
 * either privacy mode. Returns null when the local model is unavailable;
 * every caller has a lexical fallback.
 */
import { getAiSettings } from "./settings";
import { recordToLedger, hostOf } from "./ledger";

export const EMBEDDING_DIM = 768;
export const LOCAL_EMBEDDING_MODEL = "nomic-embed-text";

/**
 * nomic-embed-text is trained with task prefixes: stored text is a
 * "document", search text is a "query". Omitting them lowers retrieval quality.
 */
export type EmbedKind = "document" | "query";

export function embeddingsEnabled(): boolean {
  return process.env.SCORING_MODE !== "lexical";
}

export async function embedText(text: string, kind: EmbedKind = "document"): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  const trimmed = text.trim().slice(0, 8000);
  if (!trimmed) return null;

  const { localBaseUrl } = await getAiSettings();
  // Older installs set EMBEDDING_MODEL to a cloud slug ("openai/..."); only a
  // local model name is honoured here.
  const configured = process.env.EMBEDDING_MODEL?.trim();
  const model = configured && !configured.includes("/") ? configured : LOCAL_EMBEDDING_MODEL;
  const input = `search_${kind}: ${trimmed}`;
  const started = Date.now();
  try {
    const res = await fetch(`${localBaseUrl}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input, keep_alive: "30m" }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = res.ok ? ((await res.json()) as { embeddings?: number[][] }) : null;
    const vec = json?.embeddings?.[0];
    const ok = Boolean(vec && vec.length === EMBEDDING_DIM);
    recordToLedger({
      kind: "ai",
      purpose: "embed",
      provider: "ollama",
      model,
      destination: hostOf(localBaseUrl),
      local: true,
      bytesOut: Buffer.byteLength(input, "utf8"),
      durationMs: Date.now() - started,
      ok,
      errorReason: ok ? undefined : res.ok ? "BAD_DIMENSION" : `HTTP_${res.status}`,
    });
    return ok ? vec! : null;
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
