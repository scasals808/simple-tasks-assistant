-- CreateTable
CREATE TABLE "TaskDraft" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdTaskId" TEXT,
    "sourceChatId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceLink" TEXT,
    "creatorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDraft_pkey" PRIMARY KEY ("id")
);

-- Deduplicate historical tasks before adding unique(sourceChatId, sourceMessageId).
-- Keep the earliest task (createdAt, then id), drop the rest.
WITH ranked_tasks AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "sourceChatId", "sourceMessageId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS row_num
    FROM "Task"
)
DELETE FROM "Task" t
USING ranked_tasks r
WHERE t."id" = r."id"
  AND r.row_num > 1;

-- Preserve existing tasks with synthetic drafts.
INSERT INTO "TaskDraft" (
    "id",
    "token",
    "status",
    "createdTaskId",
    "sourceChatId",
    "sourceMessageId",
    "sourceText",
    "sourceLink",
    "creatorUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    CONCAT('legacy-', "id"),
    'FINAL',
    "id",
    "sourceChatId",
    "sourceMessageId",
    "sourceText",
    "sourceLink",
    "creatorUserId",
    "createdAt",
    "updatedAt"
FROM "Task";

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "sourceDraftId" TEXT;
UPDATE "Task" SET "sourceDraftId" = "id" WHERE "sourceDraftId" IS NULL;
ALTER TABLE "Task" ALTER COLUMN "sourceDraftId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TaskDraft_token_key" ON "TaskDraft"("token");
CREATE UNIQUE INDEX "Task_sourceDraftId_key" ON "Task"("sourceDraftId");
CREATE UNIQUE INDEX "Task_sourceChatId_sourceMessageId_key" ON "Task"("sourceChatId", "sourceMessageId");

-- AddForeignKey
ALTER TABLE "TaskDraft" ADD CONSTRAINT "TaskDraft_createdTaskId_fkey" FOREIGN KEY ("createdTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_sourceDraftId_fkey" FOREIGN KEY ("sourceDraftId") REFERENCES "TaskDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
