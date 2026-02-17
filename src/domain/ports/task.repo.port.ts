import type { Task } from "../tasks/task.types.js";
import type { TaskPriority } from "../tasks/task.types.js";

export type DraftStep =
  | "enter_text"
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
  workspaceId: string | null;
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
  findById(taskId: string): Promise<Task | null>;
  createDraft(input: {
    token: string;
    workspaceId?: string | null;
    step?: DraftStep;
    sourceChatId: string;
    sourceMessageId: string;
    sourceText: string;
    sourceLink: string | null;
    creatorUserId: string;
  }): Promise<TaskDraft>;
  findDraftByToken(token: string): Promise<TaskDraft | null>;
  findPendingDraftBySource(
    sourceChatId: string,
    sourceMessageId: string,
    creatorUserId: string
  ): Promise<TaskDraft | null>;
  findTaskBySource(sourceChatId: string, sourceMessageId: string): Promise<Task | null>;
  findByAssigneeUserId(assigneeUserId: string): Promise<Task[]>;
  listAssignedTasks(workspaceId: string, viewerUserId: string, limit: number): Promise<Task[]>;
  listCreatedTasks(workspaceId: string, viewerUserId: string, limit: number): Promise<Task[]>;
  listOnReviewTasks(workspaceId: string, limit: number): Promise<Task[]>;
  findDraftByCreatorAndStep(creatorUserId: string, step: DraftStep): Promise<TaskDraft | null>;
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
  updateDraftStepIfExpected(
    draftId: string,
    expectedStep: DraftStep,
    patch: {
      step: DraftStep;
      sourceText?: string;
      assigneeId?: string | null;
      priority?: TaskPriority | null;
      deadlineAt?: Date | null;
    }
  ): Promise<{ updated: boolean; draft: TaskDraft }>;
  createFromDraft(draft: TaskDraft): Promise<CreateFromDraftResult>;
  markDraftFinal(draftId: string, taskId: string): Promise<void>;
  
  submitForReviewTransactional(
    taskId: string,
    actorUserId: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "NOT_ASSIGNEE" }
    | { status: "ALREADY_ON_REVIEW" }
    | { status: "NONCE_EXISTS" }
    | { status: "SUCCESS"; task: Task }
  >;

  acceptReviewTransactional(
    taskId: string,
    actorUserId: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "SUCCESS"; task: Task }
  >;

  returnToWorkTransactional(
    taskId: string,
    actorUserId: string,
    comment: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "SUCCESS"; task: Task }
  >;
}
