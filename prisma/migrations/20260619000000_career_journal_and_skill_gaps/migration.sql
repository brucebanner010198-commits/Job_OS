-- AlterTable Job
ALTER TABLE "Job" ADD COLUMN "skillGaps" JSONB;
ALTER TABLE "Job" ADD COLUMN "learningLinks" JSONB;

-- CreateTable WorkLogEntry
CREATE TABLE "WorkLogEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "project" TEXT,
    "tasksDone" TEXT NOT NULL,
    "pointOfView" TEXT,
    "category" TEXT NOT NULL DEFAULT 'FEATURE',
    "rawContext" TEXT,
    "metrics" JSONB,
    "tags" TEXT[],
    "compiled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable CandidateBullet
CREATE TABLE "CandidateBullet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "workLogEntryId" TEXT,
    "bulletText" TEXT NOT NULL,
    "impactClaim" TEXT,
    "suggestedKind" TEXT NOT NULL DEFAULT 'EXPERIENCE',
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "profileEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateBullet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkLogEntry_userId_date_idx" ON "WorkLogEntry"("userId", "date");
CREATE INDEX "WorkLogEntry_profileId_date_idx" ON "WorkLogEntry"("profileId", "date");
CREATE INDEX "WorkLogEntry_profileId_compiled_idx" ON "WorkLogEntry"("profileId", "compiled");

-- CreateIndex
CREATE INDEX "CandidateBullet_userId_approved_idx" ON "CandidateBullet"("userId", "approved");
CREATE INDEX "CandidateBullet_profileId_approved_idx" ON "CandidateBullet"("profileId", "approved");

-- AddForeignKey
ALTER TABLE "WorkLogEntry" ADD CONSTRAINT "WorkLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkLogEntry" ADD CONSTRAINT "WorkLogEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateBullet" ADD CONSTRAINT "CandidateBullet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateBullet" ADD CONSTRAINT "CandidateBullet_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateBullet" ADD CONSTRAINT "CandidateBullet_workLogEntryId_fkey" FOREIGN KEY ("workLogEntryId") REFERENCES "WorkLogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
