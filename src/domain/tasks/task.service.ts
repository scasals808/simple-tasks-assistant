import type { Clock } from "../ports/clock.port.js";
import type { CreateFromDraftResult, TaskDraft, TaskRepo } from "../ports/task.repo.port.js";
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

  async finalizeDraft(
    token: string,
    requesterUserId: string
  ): Promise<CreateFromDraftResult | null> {
    const draft = await this.taskRepo.findDraftByToken(token);
    if (!draft || draft.creatorUserId !== requesterUserId) {
      return null;
    }

    const result = await this.taskRepo.createFromDraft(draft);
    await this.taskRepo.markDraftFinal(draft.id, result.task.id);
    return result;
  }
}
