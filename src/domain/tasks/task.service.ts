import type { Clock } from "../ports/clock.port.js";
import type { TaskRepo } from "../ports/task.repo.port.js";
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
}
