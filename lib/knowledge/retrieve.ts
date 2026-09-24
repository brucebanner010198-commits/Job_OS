/**
 * Knowledge Notebook - top-k semantic retrieval for apply + interview grounding.
 */
import { db } from "@/lib/db";
import { embedText, embeddingsEnabled } from "@/lib/ai/embeddings";
import { knowledgeNotebookEnabled } from "@/lib/integrations/registry";
import { ensureKnowledgeTable, listChunks } from "@/lib/knowledge/index";
import type { AppScope } from "@/lib/profiles/types";
import type { KnowledgeSourceType, RetrievedChunk, RetrieveQuery } from "@/lib/knowledge/types";

function buildQueryText(q: RetrieveQuery): string {
  const parts = [q.query];
  if (q.companyName) parts.push(`Company: ${q.companyName}`);
  if (q.jobDescription) parts.push(q.jobDescription.slice(0, 2000));
  return parts.filter(Boolean).join("\n");
}

/** Lexical fallback when embeddings unavailable. */
function lexicalScore(query: string, text: string): number {
  const qTokens = new Set(query.toLowerCase().split(/\W+/).filter((t) => t.length > 2));
  const tTokens = text.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (qTokens.size === 0 || tTokens.length === 0) return 0;
  let hits = 0;
  for (const t of tTokens) if (qTokens.has(t)) hits++;
  return hits / qTokens.size;
}

/**
 * Retrieve top-k knowledge chunks for a job JD + company name.
 */
export async function retrieveKnowledge(
  scope: AppScope,
  query: RetrieveQuery,
): Promise<RetrievedChunk[]> {
  if (!(await knowledgeNotebookEnabled())) return [];

  await ensureKnowledgeTable();
  const topK = query.topK ?? 5;
  const queryText = buildQueryText(query);

  const chunks = await listChunks(scope);
  if (chunks.length === 0) return [];

  const queryVec = embeddingsEnabled() ? await embedText(queryText, "query") : null;

  if (queryVec) {
    // One nearest-neighbour query over the HNSW index instead of loading every
    // vector into memory.
    const rows = await db.$queryRawUnsafe<
      { id: string; sourceType: string; sourceId: string | null; text: string; cacheKey: string; distance: number }[]
    >(
      `SELECT k.id, k."sourceType", k."sourceId", k.text, k."cacheKey",
              e."embedding768" <=> $3::vector AS distance
         FROM "KnowledgeChunk" k
         JOIN "TextEmbedding" e
           ON e."userId" = k."userId" AND e."cacheKey" = k."profileId" || ':' || k."cacheKey"
        WHERE k."userId" = $1 AND k."profileId" = $2 AND e."embedding768" IS NOT NULL
        ORDER BY distance
        LIMIT $4`,
      scope.userId,
      scope.profileId,
      `[${queryVec.join(",")}]`,
      topK,
    );
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        sourceType: r.sourceType as KnowledgeSourceType,
        sourceId: r.sourceId ?? undefined,
        text: r.text,
        cacheKey: r.cacheKey,
        // Cosine distance ∈ [0, 2] → similarity ∈ [0, 1], matching cosineSimilarity.
        score: Math.max(0, Math.min(1, 1 - Number(r.distance) / 2)),
      }));
    }
    // Chunks exist but none are embedded yet (index still building): fall through.
  }

  return chunks
    .map((c) => ({ ...c, score: lexicalScore(queryText, c.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
