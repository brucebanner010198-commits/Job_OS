/**
 * Knowledge Notebook - index profile, briefs, jobs into pgvector chunks.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { embedText, embeddingsEnabled } from "@/lib/ai/embeddings";
import { ensureVectorExtension, saveEmbedding } from "@/lib/scoring/embedding-relevance";
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

/** Ensure pgvector is available; tables are managed by Prisma migrations. */
export async function ensureKnowledgeTable(): Promise<void> {
  await ensureVectorExtension();
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

  await db.knowledgeChunk.upsert({
    where: {
      profileId_cacheKey: { profileId: scope.profileId, cacheKey },
    },
    create: {
      id,
      userId: scope.userId,
      profileId: scope.profileId,
      sourceType,
      sourceId,
      text: trimmed,
      cacheKey,
    },
    update: { text: trimmed },
  });

  const vec = await embedText(trimmed);
  if (!vec) return;
  const embCacheKey = `${scope.profileId}:${cacheKey}`;
  const embId = `${scope.profileId}_${cacheKey.slice(0, 32)}`;
  await saveEmbedding(scope, embId, embCacheKey, vec);
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
  const rows = await db.knowledgeChunk.findMany({
    where: scopeWhere(scope),
    orderBy: { updatedAt: "desc" },
    take: 500,
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      text: true,
      cacheKey: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    sourceType: r.sourceType as KnowledgeSourceType,
    sourceId: r.sourceId ?? undefined,
    text: r.text,
    cacheKey: r.cacheKey,
  }));
}
