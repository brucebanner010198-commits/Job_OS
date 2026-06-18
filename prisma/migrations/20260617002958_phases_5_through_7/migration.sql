-- CreateEnum
CREATE TYPE "GoalHorizon" AS ENUM ('SIX_MONTHS', 'ONE_YEAR', 'TWO_YEARS', 'THREE_YEARS', 'FOUR_YEARS', 'FIVE_YEARS', 'TEN_YEARS');

-- CreateEnum
CREATE TYPE "ProposalState" AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "WarmIntroState" AS ENUM ('PROPOSED', 'SENT', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FollowUpState" AS ENUM ('PENDING', 'DONE', 'DISMISSED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "detection" JSONB,
ADD COLUMN     "knockouts" JSONB,
ADD COLUMN     "preparedFields" JSONB,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "route" "AutonomyRoute";

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "canonicalId" TEXT,
ADD COLUMN     "excludeReason" TEXT,
ADD COLUMN     "excluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fingerprint" TEXT,
ADD COLUMN     "flags" JSONB,
ADD COLUMN     "ghostScore" DOUBLE PRECISION,
ADD COLUMN     "hardGatePass" BOOLEAN,
ADD COLUMN     "relevanceDriver" TEXT,
ADD COLUMN     "salaryMax" INTEGER,
ADD COLUMN     "salaryMin" INTEGER,
ADD COLUMN     "scamScore" DOUBLE PRECISION,
ADD COLUMN     "score" DOUBLE PRECISION,
ADD COLUMN     "scoreExplain" JSONB;

-- CreateTable
CREATE TABLE "ApplicationAnswers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workAuthorized" BOOLEAN,
    "requiresSponsorship" BOOLEAN,
    "yearsExperience" INTEGER,
    "willingToRelocate" BOOLEAN,
    "remoteOnly" BOOLEAN,
    "locations" TEXT[],
    "salaryExpectation" INTEGER,
    "salaryCurrency" TEXT DEFAULT 'USD',
    "noticePeriod" TEXT,
    "hasClearance" BOOLEAN,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "websiteUrl" TEXT,
    "eeo" JSONB,
    "customAnswers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationAnswers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "northStar" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "targetTitles" TEXT[],
    "targetIndustries" TEXT[],
    "milestones" JSONB NOT NULL,
    "rawNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "summary" TEXT,
    "claims" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyBrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "historyId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "connected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboxItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT NOT NULL,
    "rfcMessageId" TEXT,
    "fromEmail" TEXT NOT NULL,
    "fromDomain" TEXT,
    "subject" TEXT NOT NULL,
    "snippet" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasons" JSONB,
    "event" JSONB,
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusProposal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inboxItemId" TEXT NOT NULL,
    "applicationId" TEXT,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "rationale" TEXT NOT NULL,
    "requiresConfirm" BOOLEAN NOT NULL DEFAULT true,
    "state" "ProposalState" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Connection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "headline" TEXT,
    "company" TEXT,
    "companyDomain" TEXT,
    "title" TEXT,
    "relationship" TEXT NOT NULL,
    "degree" INTEGER NOT NULL DEFAULT 2,
    "howKnown" TEXT,
    "sharedContext" TEXT,
    "profileUrl" TEXT,
    "source" TEXT NOT NULL DEFAULT 'fixture',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarmIntro" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "company" TEXT NOT NULL,
    "connectionId" TEXT,
    "pathKind" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'linkedin',
    "draftSubject" TEXT,
    "draftBody" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "provenanceOk" BOOLEAN NOT NULL DEFAULT true,
    "state" "WarmIntroState" NOT NULL DEFAULT 'PROPOSED',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarmIntro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "draftSubject" TEXT,
    "draftBody" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "state" "FollowUpState" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationAnswers_userId_key" ON "ApplicationAnswers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerGoal_userId_key" ON "CareerGoal"("userId");

-- CreateIndex
CREATE INDEX "Company_userId_createdAt_idx" ON "Company"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Company_userId_name_key" ON "Company"("userId", "name");

-- CreateIndex
CREATE INDEX "CompanyBrief_userId_companyId_idx" ON "CompanyBrief"("userId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "GmailAccount_userId_key" ON "GmailAccount"("userId");

-- CreateIndex
CREATE INDEX "InboxItem_userId_receivedAt_idx" ON "InboxItem"("userId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InboxItem_userId_gmailMessageId_key" ON "InboxItem"("userId", "gmailMessageId");

-- CreateIndex
CREATE INDEX "StatusProposal_userId_state_idx" ON "StatusProposal"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "StatusProposal_inboxItemId_key" ON "StatusProposal"("inboxItemId");

-- CreateIndex
CREATE INDEX "Connection_userId_company_idx" ON "Connection"("userId", "company");

-- CreateIndex
CREATE UNIQUE INDEX "WarmIntro_userId_company_key" ON "WarmIntro"("userId", "company");

-- CreateIndex
CREATE INDEX "FollowUp_userId_state_dueAt_idx" ON "FollowUp"("userId", "state", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_applicationId_kind_key" ON "FollowUp"("applicationId", "kind");

-- CreateIndex
CREATE INDEX "Job_userId_excluded_score_idx" ON "Job"("userId", "excluded", "score");

-- AddForeignKey
ALTER TABLE "ApplicationAnswers" ADD CONSTRAINT "ApplicationAnswers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBrief" ADD CONSTRAINT "CompanyBrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyBrief" ADD CONSTRAINT "CompanyBrief_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusProposal" ADD CONSTRAINT "StatusProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusProposal" ADD CONSTRAINT "StatusProposal_inboxItemId_fkey" FOREIGN KEY ("inboxItemId") REFERENCES "InboxItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusProposal" ADD CONSTRAINT "StatusProposal_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmIntro" ADD CONSTRAINT "WarmIntro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmIntro" ADD CONSTRAINT "WarmIntro_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarmIntro" ADD CONSTRAINT "WarmIntro_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "Connection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
