-- CreateTable PrivacyLedgerEntry
CREATE TABLE IF NOT EXISTS "PrivacyLedgerEntry" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "destination" TEXT NOT NULL,
    "local" BOOLEAN NOT NULL,
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "bytesOut" INTEGER NOT NULL,
    "bytesIn" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorReason" TEXT,

    CONSTRAINT "PrivacyLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PrivacyLedgerEntry_createdAt_idx" ON "PrivacyLedgerEntry"("createdAt");
CREATE INDEX IF NOT EXISTS "PrivacyLedgerEntry_local_createdAt_idx" ON "PrivacyLedgerEntry"("local", "createdAt");
