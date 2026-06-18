-- Promote KnowledgeChunk + TextEmbedding from raw SQL to Prisma-managed tables.

CREATE EXTENSION IF NOT EXISTS vector;

-- KnowledgeChunk (may already exist from runtime raw SQL)
CREATE TABLE IF NOT EXISTS "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "text" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeChunk_userId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeChunk"
      ADD CONSTRAINT "KnowledgeChunk_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'KnowledgeChunk_profileId_fkey'
  ) THEN
    ALTER TABLE "KnowledgeChunk"
      ADD CONSTRAINT "KnowledgeChunk_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "KnowledgeChunk_profileId_cacheKey_key"
  ON "KnowledgeChunk"("profileId", "cacheKey");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_userId_profileId_idx"
  ON "KnowledgeChunk"("userId", "profileId");
CREATE INDEX IF NOT EXISTS "KnowledgeChunk_profileId_updatedAt_idx"
  ON "KnowledgeChunk"("profileId", "updatedAt");

-- TextEmbedding: add profileId FK (table created in 20260617120000_pgvector_embeddings)
ALTER TABLE "TextEmbedding" ADD COLUMN IF NOT EXISTS "profileId" TEXT;

UPDATE "TextEmbedding" te
SET "profileId" = sub.profile_id
FROM (
  SELECT
    te2.id,
    CASE
      WHEN te2."cacheKey" LIKE '%:%'
        AND length(split_part(te2."cacheKey", ':', 1)) >= 20
      THEN split_part(te2."cacheKey", ':', 1)
      ELSE (
        SELECT p.id
        FROM "Profile" p
        WHERE p."userId" = te2."userId"
        ORDER BY p."createdAt" ASC
        LIMIT 1
      )
    END AS profile_id
  FROM "TextEmbedding" te2
  WHERE te2."profileId" IS NULL
) sub
WHERE te.id = sub.id AND te."profileId" IS NULL;

ALTER TABLE "TextEmbedding" ALTER COLUMN "profileId" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TextEmbedding_userId_fkey'
  ) THEN
    ALTER TABLE "TextEmbedding"
      ADD CONSTRAINT "TextEmbedding_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TextEmbedding_profileId_fkey'
  ) THEN
    ALTER TABLE "TextEmbedding"
      ADD CONSTRAINT "TextEmbedding_profileId_fkey"
      FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TextEmbedding_profileId_cacheKey_idx"
  ON "TextEmbedding"("profileId", "cacheKey");
