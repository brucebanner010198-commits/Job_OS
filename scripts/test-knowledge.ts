/**
 * Knowledge Notebook RAG validation gate.
 * Run: npm run test:knowledge
 */
import { cosineSimilarity } from "@/lib/ai/embeddings";
import type { KnowledgeChunk } from "@/lib/knowledge/types";

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

  console.log(`\nknowledge ${passed}/${passed + failed}\n`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
