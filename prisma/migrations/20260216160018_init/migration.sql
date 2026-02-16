-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "sourceChatId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceLink" TEXT,
    "creatorUserId" TEXT NOT NULL,
    "assigneeUserId" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "deadlineAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);
