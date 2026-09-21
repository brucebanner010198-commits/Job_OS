import { getDbPool } from "../lib/db";

async function run() {
  const pool = getDbPool();
  console.log("Applying schema additions...");

  await pool.query(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cadenceConfig" JSONB;

    CREATE TABLE IF NOT EXISTS "CertificationDocument" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "profileId" TEXT NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "title" TEXT NOT NULL,
      "issuer" TEXT,
      "issueDate" TIMESTAMP(3),
      "credentialUrl" TEXT,
      "localFilePath" TEXT NOT NULL,
      "fileSize" INTEGER NOT NULL,
      "mimeType" TEXT NOT NULL,
      "profileEntryId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "CertificationDocument_userId_profileId_idx" ON "CertificationDocument"("userId", "profileId");

    CREATE TABLE IF NOT EXISTS "InterviewSimulationRound" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "profileId" TEXT NOT NULL REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      "company" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "mode" TEXT NOT NULL,
      "roundNumber" INTEGER NOT NULL DEFAULT 1,
      "overallScore" INTEGER NOT NULL,
      "categoryScores" JSONB NOT NULL,
      "strengths" TEXT[] NOT NULL DEFAULT '{}',
      "weaknesses" TEXT[] NOT NULL DEFAULT '{}',
      "recommendations" TEXT[] NOT NULL DEFAULT '{}',
      "reportMarkdown" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS "InterviewSimulationRound_userId_profileId_company_idx" ON "InterviewSimulationRound"("userId", "profileId", "company");
  `);

  console.log("Schema additions applied successfully!");
  await pool.end();
}

run().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
