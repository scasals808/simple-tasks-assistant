import type { Clock } from "../ports/clock.port.js";
import type {
  CreateFromDraftResult,
  TaskDraft,
  TaskRepo
} from "../ports/task.repo.port.js";
import type { TaskActionRepo } from "../ports/task-action.repo.port.js";
import type { WorkspaceMemberRepo } from "../ports/workspace-member.repo.port.js";
import type { Task, TaskPriority } from "./task.types.js";

export type CreateTaskInput = {
  id: string;
  workspaceId?: string | null;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  assigneeUserId: string;
  priority: TaskPriority;
  deadlineAt: Date | null;
};

export type StartDraftWizardResult =
  | { status: "NOT_FOUND" }
  | { status: "ALREADY_EXISTS"; task: Task }
  | { status: "STARTED"; draft: TaskDraft };

export type DraftUpdateResult =
  | { status: "NOT_FOUND" }
  | { status: "ALREADY_EXISTS"; task: Task }
  | { status: "UPDATED"; draft: TaskDraft };

export type ApplyDeadlineChoice = "today" | "tomorrow" | "none" | "manual";
export type ApplyDateInputResult =
  | { status: "NOT_FOUND" }
  | { status: "INVALID_DATE" }
  | { status: "UPDATED"; draft: TaskDraft };
export type DmDraftTextApplyResult =
  | { status: "NOT_FOUND" }
  | { status: "STALE_STEP"; draft: TaskDraft }
  | { status: "UPDATED"; draft: TaskDraft };

function endOfDay(date: Date): Date {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function shortDatePattern(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseYyyyMmDdToDeadline(value: string): Date | null {
  if (!shortDatePattern(value)) {
    return null;
  }
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  const localDate = new Date(year, month - 1, day);
  return endOfDay(localDate);
}

export class TaskService {
  constructor(
    private readonly clock: Clock,
    private readonly taskRepo: TaskRepo,
    private readonly workspaceMemberRepo: WorkspaceMemberRepo,
    private readonly taskActionRepo: TaskActionRepo
  ) {}

  async listAssignedTasks(input: {
    workspaceId: string;
    viewerUserId: string;
    limit?: number;
  }): Promise<{ status: "NOT_IN_WORKSPACE" } | { status: "OK"; tasks: Task[] }> {
    const membership = await this.workspaceMemberRepo.findMember(input.workspaceId, input.viewerUserId);
    if (!membership) {
      return { status: "NOT_IN_WORKSPACE" };
    }
    const limit = input.limit ?? 20;
    const tasks = await this.taskRepo.listAssignedTasks(input.workspaceId, input.viewerUserId, limit);
    return { status: "OK", tasks };
  }

  async listCreatedTasks(input: {
    workspaceId: string;
    viewerUserId: string;
    limit?: number;
  }): Promise<{ status: "NOT_IN_WORKSPACE" } | { status: "OK"; tasks: Task[] }> {
    const membership = await this.workspaceMemberRepo.findMember(input.workspaceId, input.viewerUserId);
    if (!membership) {
      return { status: "NOT_IN_WORKSPACE" };
    }
    const limit = input.limit ?? 20;
    const tasks = await this.taskRepo.listCreatedTasks(input.workspaceId, input.viewerUserId, limit);
    return { status: "OK", tasks };
  }

  async listOnReviewTasks(input: {
    workspaceId: string;
    viewerUserId: string;
    limit?: number;
  }): Promise<{ status: "NOT_IN_WORKSPACE" } | { status: "NOT_OWNER" } | { status: "OK"; tasks: Task[] }> {
    const membership = await this.workspaceMemberRepo.findMember(input.workspaceId, input.viewerUserId);
    if (!membership) {
      return { status: "NOT_IN_WORKSPACE" };
    }
    if (membership.role !== "OWNER") {
      return { status: "NOT_OWNER" };
    }
    const limit = input.limit ?? 20;
    const tasks = await this.taskRepo.listOnReviewTasks(input.workspaceId, limit);
    return { status: "OK", tasks };
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = this.clock.now();

    const task: Task = {
      id: input.id,
      workspaceId: input.workspaceId ?? null,
      sourceChatId: input.sourceChatId,
      sourceMessageId: input.sourceMessageId,
      sourceText: input.sourceText,
      sourceLink: input.sourceLink,
      creatorUserId: input.creatorUserId,
      assigneeUserId: input.assigneeUserId,
      priority: input.priority,
      deadlineAt: input.deadlineAt,
      status: "ACTIVE",
      submittedForReviewAt: null,
      lastReturnComment: null,
      lastReturnAt: null,
      lastReturnByUserId: null,
      createdAt: now,
      updatedAt: now
    };

    return this.taskRepo.create(task);
  }

  async createDraft(input: {
    token: string;
    workspaceId?: string | null;
    step?: TaskDraft["step"];
    sourceChatId: string;
    sourceMessageId: string;
    sourceText: string;
    sourceLink: string | null;
    creatorUserId: string;
  }): Promise<TaskDraft> {
    return this.taskRepo.createDraft(input);
  }

  async createOrReuseGroupDraft(input: {
    token: string;
    workspaceId?: string | null;
    sourceChatId: string;
    sourceMessageId: string;
    sourceText: string;
    sourceLink: string | null;
    creatorUserId: string;
  }): Promise<{ draft: TaskDraft; reused: boolean }> {
    const existing = await this.taskRepo.findPendingDraftBySource(
      input.sourceChatId,
      input.sourceMessageId,
      input.creatorUserId
    );
    if (existing) {
      return { draft: existing, reused: true };
    }
    const draft = await this.taskRepo.createDraft(input);
    return { draft, reused: false };
  }

  async startDmDraft(input: {
    workspaceId: string;
    creatorUserId: string;
  }): Promise<{ id: string; token: string }> {
    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const draft = await this.taskRepo.createDraft({
      token,
      workspaceId: input.workspaceId,
      step: "enter_text",
      sourceChatId: `dm:${input.creatorUserId}`,
      sourceMessageId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      sourceText: "",
      sourceLink: null,
      creatorUserId: input.creatorUserId
    });
    return { id: draft.id, token: draft.token };
  }

  async applyDmDraftText(creatorUserId: string, sourceText: string): Promise<DmDraftTextApplyResult> {
    const draft = await this.taskRepo.findDraftByCreatorAndStep(creatorUserId, "enter_text");
    if (!draft) {
      return { status: "NOT_FOUND" };
    }
    const trimmed = sourceText.trim();
    if (!trimmed) {
      return { status: "NOT_FOUND" };
    }
    const transitioned = await this.taskRepo.updateDraftStepIfExpected(draft.id, "enter_text", {
      step: "CHOOSE_ASSIGNEE",
      sourceText: trimmed
    });
    if (!transitioned.updated) {
      return { status: "STALE_STEP", draft: transitioned.draft };
    }
    return { status: "UPDATED", draft: transitioned.draft };
  }

  async getMyTasks(viewerUserId: string): Promise<Task[]> {
    return this.taskRepo.findByAssigneeUserId(viewerUserId);
  }

  async getTaskForViewer(taskId: string, viewerUserId: string): Promise<Task | null> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) {
      return null;
    }
    if (task.creatorUserId === viewerUserId || task.assigneeUserId === viewerUserId) {
      return task;
    }
    if (!task.workspaceId) {
      return null;
    }
    const membership = await this.workspaceMemberRepo.findMember(task.workspaceId, viewerUserId);
    if (membership?.role === "OWNER") {
      return task;
    }
    return null;
  }

  async startDraftWizard(token: string, requesterUserId: string): Promise<StartDraftWizardResult> {
    const draft = await this.taskRepo.findDraftByToken(token);
    if (!draft || draft.creatorUserId !== requesterUserId) {
      return { status: "NOT_FOUND" };
    }

    const existing = await this.taskRepo.findTaskBySource(draft.sourceChatId, draft.sourceMessageId);
    if (existing) {
      return { status: "ALREADY_EXISTS", task: existing };
    }

    const started = await this.taskRepo.updateDraft(draft.id, { step: "CHOOSE_ASSIGNEE" });
    return { status: "STARTED", draft: started };
  }

  async setDraftAssignee(
    token: string,
    requesterUserId: string,
    assigneeId: string
  ): Promise<DraftUpdateResult> {
    const draft = await this.taskRepo.findDraftByToken(token);
    if (!draft || draft.creatorUserId !== requesterUserId) {
      return { status: "NOT_FOUND" };
    }

    const existing = await this.taskRepo.findTaskBySource(draft.sourceChatId, draft.sourceMessageId);
    if (existing) {
      return { status: "ALREADY_EXISTS", task: existing };
    }

    const updated = await this.taskRepo.updateDraft(draft.id, {
      assigneeId,
      step: "CHOOSE_PRIORITY"
    });
    return { status: "UPDATED", draft: updated };
  }

  async setDraftPriority(
    token: string,
    requesterUserId: string,
    priority: TaskPriority
  ): Promise<DraftUpdateResult> {
    const draft = await this.taskRepo.findDraftByToken(token);
    if (!draft || draft.creatorUserId !== requesterUserId) {
      return { status: "NOT_FOUND" };
    }

    const existing = await this.taskRepo.findTaskBySource(draft.sourceChatId, draft.sourceMessageId);
    if (existing) {
      return { status: "ALREADY_EXISTS", task: existing };
    }

    const updated = await this.taskRepo.updateDraft(draft.id, {
      priority,
      step: "CHOOSE_DEADLINE"
    });
    return { status: "UPDATED", draft: updated };
  }

  async setDraftDeadlineChoice(
    token: string,
    requesterUserId: string,
    choice: ApplyDeadlineChoice
  ): Promise<DraftUpdateResult> {
    const draft = await this.taskRepo.findDraftByToken(token);
    if (!draft || draft.creatorUserId !== requesterUserId) {
      return { status: "NOT_FOUND" };
    }

    const existing = await this.taskRepo.findTaskBySource(draft.sourceChatId, draft.sourceMessageId);
    if (existing) {
      return { status: "ALREADY_EXISTS", task: existing };
    }

    const now = this.clock.now();
    if (choice === "manual") {
      const updated = await this.taskRepo.updateDraft(draft.id, {
        step: "AWAIT_DEADLINE_INPUT",
        deadlineAt: null
      });
      return { status: "UPDATED", draft: updated };
    }

    const deadlineAt =
      choice === "today"
        ? endOfDay(now)
        : choice === "tomorrow"
          ? endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
          : null;
    const updated = await this.taskRepo.updateDraft(draft.id, {
      deadlineAt,
      step: "CONFIRM"
    });
    return { status: "UPDATED", draft: updated };
  }

  async setDraftDeadlineFromText(
    requesterUserId: string,
    dateText: string
  ): Promise<ApplyDateInputResult> {
    const draft = await this.taskRepo.findAwaitingDeadlineDraftByCreator(requesterUserId);
    if (!draft) {
      return { status: "NOT_FOUND" };
    }

    const parsed = parseYyyyMmDdToDeadline(dateText.trim());
    if (!parsed) {
      return { status: "INVALID_DATE" };
    }

    const updated = await this.taskRepo.updateDraft(draft.id, {
      deadlineAt: parsed,
      step: "CONFIRM"
    });
    return { status: "UPDATED", draft: updated };
  }

  async finalizeDraft(
    token: string,
    requesterUserId: string
  ): Promise<CreateFromDraftResult | null> {
    const draft = await this.taskRepo.findDraftByToken(token);
    if (!draft || draft.creatorUserId !== requesterUserId) {
      return null;
    }
    if (draft.status === "FINAL" && draft.createdTaskId) {
      const existing = await this.taskRepo.findTaskBySource(draft.sourceChatId, draft.sourceMessageId);
      if (existing) {
        return { status: "ALREADY_EXISTS", task: existing };
      }
    }
    if (!draft.assigneeId || !draft.priority) {
      return null;
    }

    const result = await this.taskRepo.createFromDraft(draft);
    await this.taskRepo.markDraftFinal(draft.id, result.task.id);
    return result;
  }

  async submitForReview(input: {
    taskId: string;
    actorUserId: string;
    nonce: string;
  }): Promise<
    | { status: "NOT_FOUND" }
    | { status: "NOT_IN_WORKSPACE" }
    | { status: "NOT_ASSIGNEE" } 
    | { status: "ALREADY_ON_REVIEW" }
    | { status: "NONCE_EXISTS" }
    | { status: "SUCCESS"; task: Task }
  > {
    // Check if nonce already exists (idempotency)
    const existingAction = await this.taskActionRepo.findByNonce(input.nonce);
    if (existingAction) {
      return { status: "NONCE_EXISTS" };
    }

    // Use transactional repo method that handles all validations and updates
    const result = await this.taskRepo.submitForReviewTransactional(
      input.taskId,
      input.actorUserId, 
      input.nonce
    );

    if (result.status === "SUCCESS") {
      // Additional workspace membership check 
      if (result.task.workspaceId) {
        const membership = await this.workspaceMemberRepo.findMember(
          result.task.workspaceId,
          input.actorUserId
        );
        if (!membership) {
          return { status: "NOT_IN_WORKSPACE" };
        }
      }
    }

    return result;
  }

  async completeTask(input: {
    taskId: string;
    actorUserId: string;
    nonce: string;
  }): Promise<
    | { status: "NOT_FOUND" }
    | { status: "NOT_ASSIGNEE" }
    | { status: "NOT_IN_WORKSPACE" }
    | { status: "SUCCESS"; mode: "self_closed" | "review"; changed: boolean; task: Task }
  > {
    const result = await this.taskRepo.completeTaskTransactional(
      input.taskId,
      input.actorUserId,
      input.nonce
    );
    if (result.status === "SUCCESS" && result.task.workspaceId) {
      const membership = await this.workspaceMemberRepo.findMember(
        result.task.workspaceId,
        input.actorUserId
      );
      if (!membership) {
        return { status: "NOT_IN_WORKSPACE" };
      }
    }
    return result;
  }

  async acceptReview(input: {
    taskId: string;
    actorUserId: string;
    nonce: string;
  }): Promise<
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "SUCCESS"; task: Task }
  > {
    return this.taskRepo.acceptReviewTransactional(input.taskId, input.actorUserId, input.nonce);
  }

  async returnToWork(input: {
    taskId: string;
    actorUserId: string;
    comment: string;
    nonce: string;
  }): Promise<
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "SUCCESS"; task: Task }
  > {
    const result = await this.taskRepo.returnToWorkTransactional(
      input.taskId,
      input.actorUserId,
      input.comment,
      input.nonce
    );
    return result;
  }

  async beginReturnToWorkComment(input: {
    taskId: string;
    actorUserId: string;
    nonce: string;
  }): Promise<{ status: "NOT_FOUND" } | { status: "FORBIDDEN" } | { status: "READY" }> {
    const task = await this.taskRepo.findById(input.taskId);
    if (!task || !task.workspaceId || task.status !== "ON_REVIEW") {
      return { status: "NOT_FOUND" };
    }
    const membership = await this.workspaceMemberRepo.findMember(task.workspaceId, input.actorUserId);
    if (!membership || membership.role !== "OWNER") {
      return { status: "FORBIDDEN" };
    }
    await this.taskRepo.upsertActiveReturnCommentDraft({
      taskId: input.taskId,
      actorUserId: input.actorUserId,
      nonce: input.nonce
    });
    return { status: "READY" };
  }

  async applyReturnCommentFromDraft(input: {
    actorUserId: string;
    comment: string;
  }): Promise<
    | { status: "NO_ACTIVE_DRAFT" }
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "SUCCESS"; task: Task }
  > {
    const draft = await this.taskRepo.findActiveReturnCommentDraftByActor(input.actorUserId);
    if (!draft) {
      return { status: "NO_ACTIVE_DRAFT" };
    }
    const result = await this.returnToWork({
      taskId: draft.taskId,
      actorUserId: input.actorUserId,
      comment: input.comment,
      nonce: draft.nonce
    });
    await this.taskRepo.closeReviewDraft(draft.id);
    return result;
  }
}
