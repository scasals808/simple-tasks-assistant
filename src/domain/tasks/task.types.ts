export type TaskPriority = "P1" | "P2" | "P3";

export type TaskStatus = "ACTIVE" | "ON_REVIEW" | "CLOSED";

export type Task = {
  id: string;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  assigneeUserId: string;
  priority: TaskPriority;
  deadlineAt: Date | null;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
};
