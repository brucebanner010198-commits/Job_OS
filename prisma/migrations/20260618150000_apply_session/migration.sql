-- Persist cooperative apply sessions (Phase 3A) — replaces in-memory Map.

CREATE TYPE "SessionControlMode" AS ENUM ('AI', 'PAUSED', 'HANDOFF');

CREATE TABLE "ApplySession" (
    "applicationId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "mode" "SessionControlMode" NOT NULL DEFAULT 'AI',
    "applyState" "ApplyState" NOT NULL DEFAULT 'PREPARING',
    "captchaDetected" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplySession_pkey" PRIMARY KEY ("applicationId")
);

ALTER TABLE "ApplySession" ADD CONSTRAINT "ApplySession_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplySession" ADD CONSTRAINT "ApplySession_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ApplySession_profileId_updatedAt_idx" ON "ApplySession"("profileId", "updatedAt");
