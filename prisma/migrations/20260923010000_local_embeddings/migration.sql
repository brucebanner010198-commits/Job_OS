-- Local embeddings (nomic-embed-text, 768-d). Additive: the legacy 1536-d
-- column is kept, only made optional so new rows can omit it.
ALTER TABLE "TextEmbedding" ALTER COLUMN "embedding" DROP NOT NULL;
ALTER TABLE "TextEmbedding" ADD COLUMN IF NOT EXISTS "embedding768" vector(768);
CREATE INDEX IF NOT EXISTS "TextEmbedding_embedding768_hnsw"
  ON "TextEmbedding" USING hnsw ("embedding768" vector_cosine_ops);
