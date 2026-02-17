-- CreateEnum
CREATE TYPE "TaskActionType" AS ENUM ('SUBMIT_FOR_REVIEW');

-- CreateTable
CREATE TABLE "TaskAction" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "type" "TaskActionType" NOT NULL,
    "nonce" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskAction_nonce_key" ON "TaskAction"("nonce");

-- CreateIndex
CREATE INDEX "TaskAction_taskId_idx" ON "TaskAction"("taskId");

-- CreateIndex
CREATE INDEX "TaskAction_actorUserId_idx" ON "TaskAction"("actorUserId");

-- AddForeignKey
ALTER TABLE "TaskAction" ADD CONSTRAINT "TaskAction_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE RESTRICT ON UPDATE CASCADE;