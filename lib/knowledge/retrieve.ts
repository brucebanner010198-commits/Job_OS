/**
 * Knowledge Notebook - top-k semantic retrieval for apply + interview grounding.
 */
import { embedText, embeddingsEnabled } from "@/lib/ai/embeddings";
import { cosineSimilarity } from "@/lib/ai/embeddings";
import { knowledgeNotebookEnabled } from "@/lib/integrations/registry";
import { ensureKnowledgeTable, listChunks } from "@/lib/knowledge/index";
import { loadEmbeddingByCacheKey } from "@/lib/scoring/embedding-relevance";
import type { AppScope } from "@/lib/profiles/types";
import type { RetrievedChunk, RetrieveQuery } from "@/lib/knowledge/types";

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

  const queryVec = embeddingsEnabled() ? await embedText(queryText) : null;

  if (queryVec) {
    const scored: RetrievedChunk[] = [];
    for (const chunk of chunks) {
      const vec = await loadEmbeddingByCacheKey(
        scope,
        `${scope.profileId}:${chunk.cacheKey}`,
      );
      if (!vec) continue;
      scored.push({
        ...chunk,
        score: cosineSimilarity(queryVec, vec),
      });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  return chunks
    .map((c) => ({ ...c, score: lexicalScore(queryText, c.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
