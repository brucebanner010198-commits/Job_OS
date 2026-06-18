/**
 * Knowledge Notebook - index profile, briefs, jobs into pgvector chunks.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { embedText, embeddingsEnabled } from "@/lib/ai/embeddings";
import { ensureEmbeddingTable } from "@/lib/scoring/embedding-relevance";
import { knowledgeNotebookEnabled } from "@/lib/integrations/registry";
import type { AppScope } from "@/lib/profiles/types";
import { scopeWhere } from "@/lib/profiles/scope";
import type { KnowledgeChunk, KnowledgeSourceType } from "@/lib/knowledge/types";

function chunkCacheKey(
  sourceType: KnowledgeSourceType,
  sourceId: string,
  text: string,
): string {
  const hash = createHash("sha256").update(text.trim().slice(0, 4000)).digest("hex").slice(0, 16);
  return `kn:${sourceType}:${sourceId}:${hash}`;
}

export async function ensureKnowledgeTable(): Promise<void> {
  await ensureEmbeddingTable();
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "profileId" TEXT NOT NULL,
      "sourceType" TEXT NOT NULL,
      "sourceId" TEXT,
      text TEXT NOT NULL,
      "cacheKey" TEXT NOT NULL,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("profileId", "cacheKey")
    )
  `);
}

async function upsertChunk(
  scope: AppScope,
  sourceType: KnowledgeSourceType,
  sourceId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim().slice(0, 4000);
  if (!trimmed) return;
  const cacheKey = chunkCacheKey(sourceType, sourceId, trimmed);
  const id = `${scope.profileId}_${cacheKey}`.slice(0, 120);

  await db.$executeRawUnsafe(
    `INSERT INTO "KnowledgeChunk" (id, "userId", "profileId", "sourceType", "sourceId", text, "cacheKey", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT ("profileId", "cacheKey")
     DO UPDATE SET text = EXCLUDED.text, "updatedAt" = NOW()`,
    id,
    scope.userId,
    scope.profileId,
    sourceType,
    sourceId,
    trimmed,
    cacheKey,
  );

  const vec = await embedText(trimmed);
  if (!vec) return;
  const lit = `[${vec.join(",")}]`;
  const embId = `${scope.profileId}_${cacheKey.slice(0, 32)}`;
  await db.$executeRawUnsafe(
    `INSERT INTO "TextEmbedding" (id, "userId", "cacheKey", embedding, "updatedAt")
     VALUES ($1, $2, $3, $4::vector, NOW())
     ON CONFLICT ("userId", "cacheKey")
     DO UPDATE SET embedding = EXCLUDED.embedding, "updatedAt" = NOW()`,
    embId,
    scope.userId,
    `${scope.profileId}:${cacheKey}`,
    lit,
  );
}

/** Re-index all Tier-1 knowledge sources for a profile. */
export async function indexUserKnowledge(
  scope: AppScope,
): Promise<{ chunks: number }> {
  if (!(await knowledgeNotebookEnabled())) return { chunks: 0 };
  if (!embeddingsEnabled()) return { chunks: 0 };

  await ensureKnowledgeTable();

  const [entries, notes, briefs, jobs, answers] = await Promise.all([
    db.profileEntry.findMany({
      where: { ...scopeWhere(scope), sensitive: false },
    }),
    db.profileNote.findMany({
      where: scopeWhere(scope),
      take: 50,
      orderBy: { createdAt: "desc" },
    }),
    db.companyBrief.findMany({
      where: scopeWhere(scope),
      take: 20,
      orderBy: { generatedAt: "desc" },
    }),
    db.job.findMany({
      where: { ...scopeWhere(scope), excluded: false },
      take: 100,
      orderBy: { score: "desc" },
    }),
    db.applicationAnswers.findUnique({ where: { profileId: scope.profileId } }),
  ]);

  let chunks = 0;

  for (const e of entries) {
    const text = JSON.stringify(e.data);
    await upsertChunk(scope, "profile_entry", e.id, `${e.kind}: ${text}`);
    chunks++;
  }

  for (const n of notes) {
    await upsertChunk(scope, "profile_note", n.id, n.cleanedText ?? n.rawText);
    chunks++;
  }

  for (const b of briefs) {
    const claims = Array.isArray(b.claims) ? (b.claims as { text?: string }[]) : [];
    for (const c of claims) {
      if (c.text) {
        await upsertChunk(scope, "company_brief", b.id, c.text);
        chunks++;
      }
    }
    if (b.summary) {
      await upsertChunk(scope, "company_brief", b.id, b.summary);
      chunks++;
    }
  }

  for (const j of jobs) {
    const jd = [j.title, j.company, j.description].filter(Boolean).join("\n");
    await upsertChunk(scope, "job", j.id, jd);
    chunks++;
  }

  if (answers) {
    const custom = (answers.customAnswers as { question: string; answer: string }[]) ?? [];
    for (let i = 0; i < custom.length; i++) {
      await upsertChunk(
        scope,
        "application_answer",
        String(i),
        `${custom[i].question}: ${custom[i].answer}`,
      );
      chunks++;
    }
  }

  return { chunks };
}

export async function listChunks(scope: AppScope): Promise<KnowledgeChunk[]> {
  await ensureKnowledgeTable();
  const rows = await db.$queryRawUnsafe<
    { id: string; sourceType: string; sourceId: string | null; text: string; cacheKey: string }[]
  >(
    `SELECT id, "sourceType", "sourceId", text, "cacheKey"
     FROM "KnowledgeChunk" WHERE "userId" = $1 AND "profileId" = $2 ORDER BY "updatedAt" DESC LIMIT 500`,
    scope.userId,
    scope.profileId,
  );
  return rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType as KnowledgeSourceType,
    sourceId: r.sourceId ?? undefined,
    text: r.text,
    cacheKey: r.cacheKey,
  }));
}
