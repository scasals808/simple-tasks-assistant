import type { Task } from "../tasks/task.types.js";

export type TaskDraft = {
  id: string;
  token: string;
  status: "PENDING" | "FINAL";
  createdTaskId: string | null;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateFromDraftResult =
  | { status: "CREATED"; task: Task }
  | { status: "ALREADY_EXISTS"; task: Task };

export interface TaskRepo {
  create(task: Task): Promise<Task>;
  createDraft(input: {
    token: string;
    sourceChatId: string;
    sourceMessageId: string;
    sourceText: string;
    sourceLink: string | null;
    creatorUserId: string;
  }): Promise<TaskDraft>;
  findDraftByToken(token: string): Promise<TaskDraft | null>;
  createFromDraft(draft: TaskDraft): Promise<CreateFromDraftResult>;
  markDraftFinal(draftId: string, taskId: string): Promise<void>;
}
