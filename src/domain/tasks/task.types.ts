export type TaskPriority = "P1" | "P2" | "P3";

export type TaskStatus = "ACTIVE" | "ON_REVIEW" | "CLOSED";

export type Task = {
  id: string;
  workspaceId: string | null;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  assigneeUserId: string;
  priority: TaskPriority;
  deadlineAt: Date | null;
  status: TaskStatus;
  submittedForReviewAt: Date | null;
  lastReturnComment: string | null;
  lastReturnAt: Date | null;
  lastReturnByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
