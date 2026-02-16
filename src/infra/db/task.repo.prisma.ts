import type { TaskRepo } from "../../domain/ports/task.repo.port.js";
import type { Task } from "../../domain/tasks/task.types.js";
import { prisma } from "./prisma.js";

export class PrismaTaskRepo implements TaskRepo {
  async create(task: Task): Promise<Task> {
    const row = await prisma.task.create({
      data: {
        id: task.id,
        sourceChatId: task.sourceChatId,
        sourceMessageId: task.sourceMessageId,
        sourceText: task.sourceText,
        sourceLink: task.sourceLink,
        creatorUserId: task.creatorUserId,
        assigneeUserId: task.assigneeUserId,
        priority: task.priority,
        deadlineAt: task.deadlineAt,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    });

    return {
      id: row.id,
      sourceChatId: row.sourceChatId,
      sourceMessageId: row.sourceMessageId,
      sourceText: row.sourceText,
      sourceLink: row.sourceLink,
      creatorUserId: row.creatorUserId,
      assigneeUserId: row.assigneeUserId,
      priority: row.priority as Task["priority"],
      deadlineAt: row.deadlineAt,
      status: row.status as Task["status"],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
