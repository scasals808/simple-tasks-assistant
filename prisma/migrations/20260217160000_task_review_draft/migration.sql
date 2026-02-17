CREATE TABLE IF NOT EXISTS "TaskReviewDraft" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "step" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TaskReviewDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskReviewDraft_nonce_key" ON "TaskReviewDraft"("nonce");
CREATE INDEX IF NOT EXISTS "TaskReviewDraft_actorUserId_status_idx" ON "TaskReviewDraft"("actorUserId", "status");
CREATE INDEX IF NOT EXISTS "TaskReviewDraft_taskId_status_idx" ON "TaskReviewDraft"("taskId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TaskReviewDraft_taskId_fkey'
  ) THEN
    ALTER TABLE "TaskReviewDraft"
      ADD CONSTRAINT "TaskReviewDraft_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
