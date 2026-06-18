/**
 * pgvector-backed embedding cache + semantic axis similarity.
 *
 * Lexical scoring (lib/scoring/relevance.ts) remains the deterministic fallback
 * for offline tests and when OpenRouter is unconfigured. Live ingest uses this
 * module when embeddings are available.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import {
  cosineSimilarity,
  embedText,
  embeddingsEnabled,
  EMBEDDING_DIM,
} from "@/lib/ai/embeddings";
import {
  axisSimilarity,
  goalAwareRelevance,
  type RelevanceDriver,
  type RelevanceResult,
} from "@/lib/scoring/relevance";
import type { AppScope } from "@/lib/profiles/types";

export { EMBEDDING_DIM };

function cacheKey(scope: AppScope, text: string): string {
  return createHash("sha256")
    .update(`${scope.profileId}:${text.trim().slice(0, 8000)}`)
    .digest("hex");
}

function vectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

/** Ensure pgvector extension exists (idempotent). */
export async function ensureVectorExtension(): Promise<void> {
  try {
    await db.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  } catch {
    /* extension may already exist or DB may not support it */
  }
}

/** Ensure the TextEmbedding cache table exists (idempotent). */
export async function ensureEmbeddingTable(): Promise<void> {
  await ensureVectorExtension();
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "TextEmbedding" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "cacheKey" TEXT NOT NULL,
      embedding vector(${EMBEDDING_DIM}) NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("userId", "cacheKey")
    )
  `);
}

/** Load a cached embedding vector for (scope, text). */
async function loadCached(
  scope: AppScope,
  text: string,
): Promise<number[] | null> {
  const key = cacheKey(scope, text);
  try {
    const rows = await db.$queryRawUnsafe<{ embedding: string }[]>(
      `SELECT embedding::text AS embedding FROM "TextEmbedding"
       WHERE "userId" = $1 AND "cacheKey" = $2 LIMIT 1`,
      scope.userId,
      key,
    );
    const raw = rows[0]?.embedding;
    if (!raw) return null;
    const trimmed = raw.trim();
    const parsed = trimmed.startsWith("[")
      ? (JSON.parse(trimmed) as number[])
      : trimmed.split(",").map(Number);
    return parsed.length > 0 && !parsed.some(Number.isNaN) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persist an embedding vector. */
async function saveCached(
  scope: AppScope,
  text: string,
  vec: number[],
): Promise<void> {
  const key = cacheKey(scope, text);
  const id = `${scope.profileId}_${key.slice(0, 16)}`;
  const lit = vectorLiteral(vec);
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "TextEmbedding" (id, "userId", "cacheKey", embedding, "updatedAt")
       VALUES ($1, $2, $3, $4::vector, NOW())
       ON CONFLICT ("userId", "cacheKey")
       DO UPDATE SET embedding = EXCLUDED.embedding, "updatedAt" = NOW()`,
      id,
      scope.userId,
      key,
      lit,
    );
  } catch {
    /* cache write failure is non-fatal */
  }
}

/**
 * Get or compute an embedding for text, using the DB cache when possible.
 */
export async function getOrCreateEmbedding(
  scope: AppScope,
  text: string,
): Promise<number[] | null> {
  if (!embeddingsEnabled()) return null;
  const cached = await loadCached(scope, text);
  if (cached) return cached;
  const vec = await embedText(text);
  if (!vec) return null;
  await saveCached(scope, text, vec);
  return vec;
}

/** Semantic axis similarity with lexical fallback. */
export async function embeddingAxisSimilarity(
  scope: AppScope,
  jobText: string,
  axisText: string,
): Promise<number> {
  const [jobVec, axisVec] = await Promise.all([
    getOrCreateEmbedding(scope, jobText),
    getOrCreateEmbedding(scope, axisText),
  ]);
  if (jobVec && axisVec) return cosineSimilarity(jobVec, axisVec);
  return axisSimilarity(jobText, axisText);
}

/**
 * Goal-aware relevance using embeddings when available, else lexical overlap.
 */
export async function goalAwareRelevanceAsync(
  scope: AppScope,
  jobText: string,
  axes: { resumeText: string; goalText: string },
): Promise<RelevanceResult & { mode: "embedding" | "lexical" }> {
  if (!embeddingsEnabled()) {
    return { ...goalAwareRelevance(jobText, axes), mode: "lexical" };
  }

  await ensureEmbeddingTable();

  const [resume, goals] = await Promise.all([
    embeddingAxisSimilarity(scope, jobText, axes.resumeText),
    embeddingAxisSimilarity(scope, jobText, axes.goalText),
  ]);

  const relevance = Math.max(resume, goals);
  const DRIVER_EPSILON = 0.02;
  let drivenBy: RelevanceDriver;
  if (Math.abs(resume - goals) <= DRIVER_EPSILON) drivenBy = "both";
  else drivenBy = resume > goals ? "resume" : "goals";

  const usedEmbedding =
    (await getOrCreateEmbedding(scope, jobText)) !== null;

  return {
    relevance,
    resume,
    goals,
    drivenBy,
    mode: usedEmbedding ? "embedding" : "lexical",
  };
}
