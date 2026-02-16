-- AlterTable
ALTER TABLE "TaskDraft"
ADD COLUMN "step" TEXT NOT NULL DEFAULT 'CHOOSE_ASSIGNEE',
ADD COLUMN "assigneeId" TEXT,
ADD COLUMN "priority" TEXT,
ADD COLUMN "deadlineAt" TIMESTAMP(3);

-- Backfill for existing finalized drafts.
UPDATE "TaskDraft"
SET "step" = 'FINAL'
WHERE "status" = 'FINAL';
