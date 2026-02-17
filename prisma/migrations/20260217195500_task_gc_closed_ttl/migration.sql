-- AlterTable
ALTER TABLE "Task"
ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Task_workspaceId_status_closedAt_idx" ON "Task"("workspaceId", "status", "closedAt");
