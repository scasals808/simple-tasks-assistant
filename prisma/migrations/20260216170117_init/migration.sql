-- CreateTable
CREATE TABLE "PendingDeletion" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "deleteAfterAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingDeletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingDeletion_status_deleteAfterAt_idx" ON "PendingDeletion"("status", "deleteAfterAt");
