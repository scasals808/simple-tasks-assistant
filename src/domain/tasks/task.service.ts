import type { Clock } from "../ports/clock.port.js";
import type {
  CreateFromDraftResult,
  TaskDraft,
  TaskRepo
} from "../ports/task.repo.port.js";
import type { Task, TaskPriority } from "./task.types.js";

export type CreateTaskInput = {
  id: string;
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
    private readonly taskRepo: TaskRepo
  ) {}

  async createTask(input: CreateTaskInput): Promise<Task> {
    const now = this.clock.now();

    const task: Task = {
      id: input.id,
      sourceChatId: input.sourceChatId,
      sourceMessageId: input.sourceMessageId,
      sourceText: input.sourceText,
      sourceLink: input.sourceLink,
      creatorUserId: input.creatorUserId,
      assigneeUserId: input.assigneeUserId,
      priority: input.priority,
      deadlineAt: input.deadlineAt,
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now
    };

    return this.taskRepo.create(task);
  }

  async createDraft(input: {
    token: string;
    sourceChatId: string;
    sourceMessageId: string;
    sourceText: string;
    sourceLink: string | null;
    creatorUserId: string;
  }): Promise<TaskDraft> {
    return this.taskRepo.createDraft(input);
  }

  async getMyTasks(viewerUserId: string): Promise<Task[]> {
    return this.taskRepo.findByAssigneeUserId(viewerUserId);
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
}
