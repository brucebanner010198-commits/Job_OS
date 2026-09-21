-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cadenceConfig" JSONB;

-- CreateTable CertificationDocument
CREATE TABLE IF NOT EXISTS "CertificationDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "issueDate" TIMESTAMP(3),
    "credentialUrl" TEXT,
    "localFilePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "profileEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CertificationDocument_userId_profileId_idx" ON "CertificationDocument"("userId", "profileId");

-- AddForeignKey
ALTER TABLE "CertificationDocument" DROP CONSTRAINT IF EXISTS "CertificationDocument_userId_fkey";
ALTER TABLE "CertificationDocument" ADD CONSTRAINT "CertificationDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CertificationDocument" DROP CONSTRAINT IF EXISTS "CertificationDocument_profileId_fkey";
ALTER TABLE "CertificationDocument" ADD CONSTRAINT "CertificationDocument_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable InterviewSimulationRound
CREATE TABLE IF NOT EXISTS "InterviewSimulationRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewSimulationRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InterviewSimulationRound_userId_profileId_company_idx" ON "InterviewSimulationRound"("userId", "profileId", "company");

-- AddForeignKey
ALTER TABLE "InterviewSimulationRound" DROP CONSTRAINT IF EXISTS "InterviewSimulationRound_userId_fkey";
ALTER TABLE "InterviewSimulationRound" ADD CONSTRAINT "InterviewSimulationRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewSimulationRound" DROP CONSTRAINT IF EXISTS "InterviewSimulationRound_profileId_fkey";
ALTER TABLE "InterviewSimulationRound" ADD CONSTRAINT "InterviewSimulationRound_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
