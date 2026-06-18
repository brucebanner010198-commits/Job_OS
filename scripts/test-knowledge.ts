/**
 * Knowledge Notebook RAG validation gate.
 * Run: npm run test:knowledge
 */
import { cosineSimilarity } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import { listChunks } from "@/lib/knowledge/index";
import { retrieveKnowledge } from "@/lib/knowledge/retrieve";
import type { KnowledgeChunk } from "@/lib/knowledge/types";
import { createProfile, deleteProfile, ensureDefaultProfile } from "@/lib/profiles/service";
import { getPrimaryUser } from "@/lib/user";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean): void {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

async function dbPing(): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return false;
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log("\nknowledge - pure helpers:");

  const sim = cosineSimilarity([1, 0, 0], [1, 0, 0]);
  check("cosineSimilarity identical vectors = 1", Math.abs(sim - 1) < 0.001);

  const chunk: KnowledgeChunk = {
    id: "c1",
    sourceType: "job",
    sourceId: "j1",
    text: "Senior backend engineer at Acme AI",
    cacheKey: "kn:job:j1:abc",
  };
  check("chunk shape valid", chunk.sourceType === "job" && chunk.text.length > 0);

  const dbAvailable = await dbPing();
  if (!dbAvailable) {
    console.log("\nknowledge - DB integration: skipped (no DATABASE_URL)");
  } else {
    console.log("\nknowledge - DB integration:");

    const user = await getPrimaryUser();
    const profile = await ensureDefaultProfile(user.id);
    const scope = { userId: user.id, profileId: profile.id };
    const other = await createProfile(user.id, `KnTest-${Date.now()}`);
    const cacheKey = `kn:job:test-${Date.now()}:deadbeef`;
    const chunkId = `${profile.id}_${cacheKey}`.slice(0, 120);

    try {
      await db.knowledgeChunk.upsert({
        where: { profileId_cacheKey: { profileId: profile.id, cacheKey } },
        create: {
          id: chunkId,
          userId: user.id,
          profileId: profile.id,
          sourceType: "job",
          sourceId: "test-job",
          text: "Rust systems engineer distributed databases",
          cacheKey,
        },
        update: { text: "Rust systems engineer distributed databases" },
      });

      const listed = await listChunks(scope);
      check(
        "listChunks returns upserted chunk",
        listed.some((c) => c.cacheKey === cacheKey),
      );

      const otherScope = { userId: user.id, profileId: other.id };
      const otherListed = await listChunks(otherScope);
      check(
        "listChunks isolates by profileId",
        !otherListed.some((c) => c.cacheKey === cacheKey),
      );

      const retrieved = await retrieveKnowledge(scope, {
        query: "Rust distributed databases",
        topK: 3,
      });
      check(
        "retrieveKnowledge lexical fallback ranks chunk",
        retrieved.some((c) => c.cacheKey === cacheKey && c.score > 0),
      );
    } finally {
      await db.knowledgeChunk.deleteMany({
        where: { profileId: { in: [profile.id, other.id] }, cacheKey },
      });
      await deleteProfile(user.id, other.id);
    }
  }

  console.log(`\nknowledge ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
