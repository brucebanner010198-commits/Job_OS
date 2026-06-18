-- Multi-profile support: named identities within one install, scoped career data.

-- CreateTable
CREATE TABLE "Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Profile_userId_idx" ON "Profile"("userId");
CREATE UNIQUE INDEX "Profile_userId_name_key" ON "Profile"("userId", "name");

ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default profile per existing user
INSERT INTO "Profile" ("id", "userId", "name", "createdAt", "updatedAt")
SELECT
    'prof_' || substr(md5("id" || ':default'), 1, 20),
    "id",
    'Default',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

-- Add nullable profileId columns
ALTER TABLE "ProfileNote" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Target" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ResumeVersion" ADD COLUMN "profileId" TEXT;
ALTER TABLE "CoverLetter" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ProfileEntry" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Job" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Application" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ApplicationAnswers" ADD COLUMN "profileId" TEXT;
ALTER TABLE "CareerGoal" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Company" ADD COLUMN "profileId" TEXT;
ALTER TABLE "CompanyBrief" ADD COLUMN "profileId" TEXT;
ALTER TABLE "GmailAccount" ADD COLUMN "profileId" TEXT;
ALTER TABLE "InboxItem" ADD COLUMN "profileId" TEXT;
ALTER TABLE "StatusProposal" ADD COLUMN "profileId" TEXT;
ALTER TABLE "Connection" ADD COLUMN "profileId" TEXT;
ALTER TABLE "WarmIntro" ADD COLUMN "profileId" TEXT;
ALTER TABLE "FollowUp" ADD COLUMN "profileId" TEXT;
ALTER TABLE "StudyGuide" ADD COLUMN "profileId" TEXT;
ALTER TABLE "InterviewSession" ADD COLUMN "profileId" TEXT;
ALTER TABLE "VoiceUsage" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ScheduledRun" ADD COLUMN "profileId" TEXT;
ALTER TABLE "ProfileBackup" ADD COLUMN "profileId" TEXT;

-- Backfill from each user's Default profile
UPDATE "ProfileNote" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "Target" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "ResumeVersion" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "CoverLetter" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "ProfileEntry" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "Job" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "Application" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "ApplicationAnswers" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "CareerGoal" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "Company" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "CompanyBrief" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "GmailAccount" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "InboxItem" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "StatusProposal" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "Connection" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "WarmIntro" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "FollowUp" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "StudyGuide" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "InterviewSession" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "VoiceUsage" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "ScheduledRun" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;
UPDATE "ProfileBackup" t SET "profileId" = p."id"
FROM "Profile" p WHERE p."userId" = t."userId" AND p."name" = 'Default' AND t."profileId" IS NULL;

-- NOT NULL + FKs
ALTER TABLE "ProfileNote" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Target" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "ResumeVersion" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "CoverLetter" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "ProfileEntry" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Application" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "ApplicationAnswers" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "CareerGoal" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Company" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "CompanyBrief" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "GmailAccount" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "InboxItem" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "StatusProposal" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "Connection" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "WarmIntro" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "FollowUp" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "StudyGuide" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "InterviewSession" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "VoiceUsage" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "ScheduledRun" ALTER COLUMN "profileId" SET NOT NULL;
ALTER TABLE "ProfileBackup" ALTER COLUMN "profileId" SET NOT NULL;

ALTER TABLE "ProfileNote" ADD CONSTRAINT "ProfileNote_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Target" ADD CONSTRAINT "Target_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResumeVersion" ADD CONSTRAINT "ResumeVersion_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileEntry" ADD CONSTRAINT "ProfileEntry_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Job" ADD CONSTRAINT "Job_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApplicationAnswers" ADD CONSTRAINT "ApplicationAnswers_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareerGoal" ADD CONSTRAINT "CareerGoal_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Company" ADD CONSTRAINT "Company_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyBrief" ADD CONSTRAINT "CompanyBrief_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmailAccount" ADD CONSTRAINT "GmailAccount_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InboxItem" ADD CONSTRAINT "InboxItem_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StatusProposal" ADD CONSTRAINT "StatusProposal_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Connection" ADD CONSTRAINT "Connection_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarmIntro" ADD CONSTRAINT "WarmIntro_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUp" ADD CONSTRAINT "FollowUp_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudyGuide" ADD CONSTRAINT "StudyGuide_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VoiceUsage" ADD CONSTRAINT "VoiceUsage_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduledRun" ADD CONSTRAINT "ScheduledRun_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfileBackup" ADD CONSTRAINT "ProfileBackup_profileId_fkey"
    FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Swap unique constraints from userId to profileId
DROP INDEX IF EXISTS "Job_userId_identityHash_key";
CREATE UNIQUE INDEX "Job_profileId_identityHash_key" ON "Job"("profileId", "identityHash");

DROP INDEX IF EXISTS "Company_userId_name_key";
CREATE UNIQUE INDEX "Company_profileId_name_key" ON "Company"("profileId", "name");

DROP INDEX IF EXISTS "InboxItem_userId_gmailMessageId_key";
CREATE UNIQUE INDEX "InboxItem_profileId_gmailMessageId_key" ON "InboxItem"("profileId", "gmailMessageId");

DROP INDEX IF EXISTS "WarmIntro_userId_company_key";
CREATE UNIQUE INDEX "WarmIntro_profileId_company_key" ON "WarmIntro"("profileId", "company");

DROP INDEX IF EXISTS "StudyGuide_userId_company_key";
CREATE UNIQUE INDEX "StudyGuide_profileId_company_key" ON "StudyGuide"("profileId", "company");

DROP INDEX IF EXISTS "VoiceUsage_userId_day_key";
CREATE UNIQUE INDEX "VoiceUsage_profileId_day_key" ON "VoiceUsage"("profileId", "day");

DROP INDEX IF EXISTS "ScheduledRun_userId_kind_key";
CREATE UNIQUE INDEX "ScheduledRun_profileId_kind_key" ON "ScheduledRun"("profileId", "kind");

DROP INDEX IF EXISTS "ApplicationAnswers_userId_key";
CREATE UNIQUE INDEX "ApplicationAnswers_profileId_key" ON "ApplicationAnswers"("profileId");

DROP INDEX IF EXISTS "CareerGoal_userId_key";
CREATE UNIQUE INDEX "CareerGoal_profileId_key" ON "CareerGoal"("profileId");

DROP INDEX IF EXISTS "GmailAccount_userId_key";
CREATE UNIQUE INDEX "GmailAccount_profileId_key" ON "GmailAccount"("profileId");

-- Profile-scoped indexes
CREATE INDEX "ProfileNote_profileId_createdAt_idx" ON "ProfileNote"("profileId", "createdAt");
CREATE INDEX "Target_profileId_createdAt_idx" ON "Target"("profileId", "createdAt");
CREATE INDEX "ResumeVersion_profileId_createdAt_idx" ON "ResumeVersion"("profileId", "createdAt");
CREATE INDEX "CoverLetter_profileId_createdAt_idx" ON "CoverLetter"("profileId", "createdAt");
CREATE INDEX "ProfileEntry_profileId_kind_idx" ON "ProfileEntry"("profileId", "kind");
CREATE INDEX "Job_profileId_firstSeenAt_idx" ON "Job"("profileId", "firstSeenAt");
CREATE INDEX "Job_profileId_excluded_score_idx" ON "Job"("profileId", "excluded", "score");
CREATE INDEX "Application_profileId_status_idx" ON "Application"("profileId", "status");
CREATE INDEX "Company_profileId_createdAt_idx" ON "Company"("profileId", "createdAt");
CREATE INDEX "CompanyBrief_profileId_companyId_idx" ON "CompanyBrief"("profileId", "companyId");
CREATE INDEX "InboxItem_profileId_receivedAt_idx" ON "InboxItem"("profileId", "receivedAt");
CREATE INDEX "StatusProposal_profileId_state_idx" ON "StatusProposal"("profileId", "state");
CREATE INDEX "Connection_profileId_company_idx" ON "Connection"("profileId", "company");
CREATE INDEX "FollowUp_profileId_state_dueAt_idx" ON "FollowUp"("profileId", "state", "dueAt");
CREATE INDEX "StudyGuide_profileId_createdAt_idx" ON "StudyGuide"("profileId", "createdAt");
CREATE INDEX "InterviewSession_profileId_createdAt_idx" ON "InterviewSession"("profileId", "createdAt");
CREATE INDEX "ProfileBackup_profileId_createdAt_idx" ON "ProfileBackup"("profileId", "createdAt");
CREATE INDEX "ProfileBackup_profileId_contentHash_idx" ON "ProfileBackup"("profileId", "contentHash");

-- Knowledge notebook (raw SQL table): add profileId when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'KnowledgeChunk'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'KnowledgeChunk' AND column_name = 'profileId'
    ) THEN
      ALTER TABLE "KnowledgeChunk" ADD COLUMN "profileId" TEXT;
      UPDATE "KnowledgeChunk" k SET "profileId" = p."id"
      FROM "Profile" p
      WHERE p."userId" = k."userId" AND p."name" = 'Default' AND k."profileId" IS NULL;
      ALTER TABLE "KnowledgeChunk" ALTER COLUMN "profileId" SET NOT NULL;
      DROP INDEX IF EXISTS "KnowledgeChunk_userId_cacheKey_key";
      CREATE UNIQUE INDEX "KnowledgeChunk_profileId_cacheKey_key"
        ON "KnowledgeChunk"("profileId", "cacheKey");
    END IF;
  END IF;
END $$;
