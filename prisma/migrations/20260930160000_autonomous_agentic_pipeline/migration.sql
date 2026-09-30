-- AlterEnum
ALTER TYPE "ApplicationStatus" ADD VALUE 'WISHLIST';

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "behavioralTraits" JSONB,
ADD COLUMN     "coreCompetencies" JSONB,
ADD COLUMN     "dealBreakers" JSONB,
ADD COLUMN     "education" JSONB,
ADD COLUMN     "experience" JSONB;

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "coverLetterText" TEXT,
ADD COLUMN     "jobPostingId" TEXT,
ADD COLUMN     "tailoredCv" TEXT;

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEvaluation" (
    "id" TEXT NOT NULL,
    "jobPostingId" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "pros" TEXT[],
    "cons" TEXT[],
    "missingKeywords" TEXT[],
    "rubric" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "frequencyCount" INTEGER NOT NULL DEFAULT 1,
    "targetDate" TIMESTAMP(3),
    "curriculum" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobPosting_userId_createdAt_idx" ON "JobPosting"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JobPosting_profileId_createdAt_idx" ON "JobPosting"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobEvaluation_jobPostingId_key" ON "JobEvaluation"("jobPostingId");

-- CreateIndex
CREATE INDEX "JobEvaluation_jobPostingId_idx" ON "JobEvaluation"("jobPostingId");

-- CreateIndex
CREATE INDEX "JobEvaluation_fitScore_idx" ON "JobEvaluation"("fitScore");

-- CreateIndex
CREATE INDEX "LearningGoal_userId_status_idx" ON "LearningGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "LearningGoal_profileId_status_idx" ON "LearningGoal"("profileId", "status");

-- CreateIndex
CREATE INDEX "LearningGoal_profileId_skill_idx" ON "LearningGoal"("profileId", "skill");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobPostingId_key" ON "Application"("jobPostingId");

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEvaluation" ADD CONSTRAINT "JobEvaluation_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGoal" ADD CONSTRAINT "LearningGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGoal" ADD CONSTRAINT "LearningGoal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
