/**
 * Knowledge Notebook RAG validation gate.
 * Run: npm run test:knowledge
 */
import { cosineSimilarity } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";
import { indexUserKnowledge, listChunks } from "@/lib/knowledge/index";
import { retrieveKnowledge } from "@/lib/knowledge/retrieve";
import type { KnowledgeChunk } from "@/lib/knowledge/types";
import { saveNote } from "@/lib/profile/service";
import { createProfile, deleteProfile } from "@/lib/profiles/service";
import { getPrimaryUser } from "@/lib/user";

const ROUNDTRIP_MARKER = "ZephyrKV roundtrip marker distributed systems Rust";

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
    const profile = await createProfile(user.id, `KnMain-${Date.now()}`);
    const other = await createProfile(user.id, `KnOther-${Date.now()}`);
    const scope = { userId: user.id, profileId: profile.id };
    const otherScope = { userId: user.id, profileId: other.id };

    try {
      await saveNote(
        scope,
        `test-knowledge ${ROUNDTRIP_MARKER}`,
        ROUNDTRIP_MARKER,
        "dictation",
      );

      const indexed = await indexUserKnowledge(scope);
      check("indexUserKnowledge indexes profile note", indexed.chunks > 0);

      const listed = await listChunks(scope);
      check(
        "listChunks returns indexed chunk",
        listed.some((c) => c.text.includes("ZephyrKV")),
      );

      const otherIndexed = await indexUserKnowledge(otherScope);
      check("other profile index is empty without data", otherIndexed.chunks === 0);

      const otherListed = await listChunks(otherScope);
      check(
        "listChunks isolates by profileId",
        !otherListed.some((c) => c.text.includes("ZephyrKV")),
      );

      const retrieved = await retrieveKnowledge(scope, {
        query: "ZephyrKV distributed Rust",
        topK: 5,
      });
      check(
        "retrieveKnowledge index→retrieve round-trip",
        retrieved.some((c) => c.text.includes("ZephyrKV") && c.score > 0),
      );

      const otherRetrieved = await retrieveKnowledge(otherScope, {
        query: "ZephyrKV distributed Rust",
        topK: 5,
      });
      check(
        "retrieveKnowledge isolates by profileId",
        !otherRetrieved.some((c) => c.text.includes("ZephyrKV")),
      );
    } finally {
      await db.profileNote.deleteMany({
        where: { profileId: profile.id, rawText: { contains: "test-knowledge" } },
      });
      await db.knowledgeChunk.deleteMany({
        where: { profileId: { in: [profile.id, other.id] } },
      });
      await deleteProfile(user.id, profile.id);
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
