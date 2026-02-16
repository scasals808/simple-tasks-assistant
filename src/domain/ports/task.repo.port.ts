import type { Task } from "../tasks/task.types.js";
import type { TaskPriority } from "../tasks/task.types.js";

export type DraftStep =
  | "CHOOSE_ASSIGNEE"
  | "CHOOSE_PRIORITY"
  | "CHOOSE_DEADLINE"
  | "AWAIT_DEADLINE_INPUT"
  | "CONFIRM"
  | "FINAL";

export type TaskDraft = {
  id: string;
  token: string;
  status: "PENDING" | "FINAL";
  step: DraftStep;
  createdTaskId: string | null;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  assigneeId: string | null;
  priority: TaskPriority | null;
  deadlineAt: Date | null;
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
  findTaskBySource(sourceChatId: string, sourceMessageId: string): Promise<Task | null>;
  findAwaitingDeadlineDraftByCreator(creatorUserId: string): Promise<TaskDraft | null>;
  updateDraft(
    draftId: string,
    patch: {
      step?: DraftStep;
      assigneeId?: string | null;
      priority?: TaskPriority | null;
      deadlineAt?: Date | null;
      status?: "PENDING" | "FINAL";
      createdTaskId?: string | null;
    }
  ): Promise<TaskDraft>;
  createFromDraft(draft: TaskDraft): Promise<CreateFromDraftResult>;
  markDraftFinal(draftId: string, taskId: string): Promise<void>;
}
