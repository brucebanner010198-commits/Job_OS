-- CreateTable
CREATE TABLE "ProfileBackup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "contentHash" TEXT NOT NULL,
    "entryCount" INTEGER NOT NULL,
    "noteCount" INTEGER NOT NULL,
    "sensitiveCount" INTEGER NOT NULL DEFAULT 0,
    "byteSize" INTEGER NOT NULL,
    "algo" TEXT NOT NULL DEFAULT 'aes-256-gcm',
    "filePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileBackup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileBackup_userId_createdAt_idx" ON "ProfileBackup"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileBackup_userId_contentHash_idx" ON "ProfileBackup"("userId", "contentHash");

-- AddForeignKey
ALTER TABLE "ProfileBackup" ADD CONSTRAINT "ProfileBackup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
