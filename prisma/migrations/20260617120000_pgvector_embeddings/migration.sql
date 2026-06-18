-- Phase 12 audit: pgvector embedding cache for semantic job relevance scoring.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "TextEmbedding" (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("userId", "cacheKey")
);

CREATE INDEX IF NOT EXISTS "TextEmbedding_userId_cacheKey_idx"
  ON "TextEmbedding" ("userId", "cacheKey");
