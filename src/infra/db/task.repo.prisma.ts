import { Prisma } from "@prisma/client";

import type {
  CreateFromDraftResult,
  TaskDraft,
  TaskRepo
} from "../../domain/ports/task.repo.port.js";
import type { Task } from "../../domain/tasks/task.types.js";
import { prisma } from "./prisma.js";

function mapTask(row: {
  id: string;
  sourceDraftId: string;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  assigneeUserId: string;
  priority: string;
  deadlineAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Task {
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

function mapDraft(row: {
  id: string;
  token: string;
  status: string;
  createdTaskId: string | null;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): TaskDraft {
  return {
    id: row.id,
    token: row.token,
    status: row.status as TaskDraft["status"],
    createdTaskId: row.createdTaskId,
    sourceChatId: row.sourceChatId,
    sourceMessageId: row.sourceMessageId,
    sourceText: row.sourceText,
    sourceLink: row.sourceLink,
    creatorUserId: row.creatorUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export class PrismaTaskRepo implements TaskRepo {
  async create(task: Task): Promise<Task> {
    await prisma.taskDraft.upsert({
      where: { id: task.id },
      update: {},
      create: {
        id: task.id,
        token: `legacy-${task.id}`,
        status: "FINAL",
        createdTaskId: task.id,
        sourceChatId: task.sourceChatId,
        sourceMessageId: task.sourceMessageId,
        sourceText: task.sourceText,
        sourceLink: task.sourceLink,
        creatorUserId: task.creatorUserId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    });

    const row = await prisma.task.create({
      data: {
        id: task.id,
        sourceDraftId: task.id,
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

    return mapTask(row);
  }

  async createDraft(input: {
    token: string;
    sourceChatId: string;
    sourceMessageId: string;
    sourceText: string;
    sourceLink: string | null;
    creatorUserId: string;
  }): Promise<TaskDraft> {
    const row = await prisma.taskDraft.create({
      data: {
        token: input.token,
        status: "PENDING",
        sourceChatId: input.sourceChatId,
        sourceMessageId: input.sourceMessageId,
        sourceText: input.sourceText,
        sourceLink: input.sourceLink,
        creatorUserId: input.creatorUserId
      }
    });
    return mapDraft(row);
  }

  async findDraftByToken(token: string): Promise<TaskDraft | null> {
    const row = await prisma.taskDraft.findUnique({
      where: { token }
    });
    return row ? mapDraft(row) : null;
  }

  async createFromDraft(draft: TaskDraft): Promise<CreateFromDraftResult> {
    try {
      const row = await prisma.task.create({
        data: {
          sourceDraftId: draft.id,
          sourceChatId: draft.sourceChatId,
          sourceMessageId: draft.sourceMessageId,
          sourceText: draft.sourceText,
          sourceLink: draft.sourceLink,
          creatorUserId: draft.creatorUserId,
          assigneeUserId: draft.creatorUserId,
          priority: "P2",
          deadlineAt: null,
          status: "ACTIVE"
        }
      });
      return { status: "CREATED", task: mapTask(row) };
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) {
        throw error;
      }

      const existing = await prisma.task.findFirst({
        where: {
          OR: [
            { sourceDraftId: draft.id },
            {
              sourceChatId: draft.sourceChatId,
              sourceMessageId: draft.sourceMessageId
            }
          ]
        },
        orderBy: { createdAt: "asc" }
      });

      if (!existing) {
        throw error;
      }

      return { status: "ALREADY_EXISTS", task: mapTask(existing) };
    }
  }

  async markDraftFinal(draftId: string, taskId: string): Promise<void> {
    await prisma.taskDraft.update({
      where: { id: draftId },
      data: {
        status: "FINAL",
        createdTaskId: taskId
      }
    });
  }
}
