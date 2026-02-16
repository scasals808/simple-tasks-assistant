import { Prisma } from "@prisma/client";

import type {
  CreateFromDraftResult,
  DraftStep,
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
  step: string;
  createdTaskId: string | null;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  assigneeId: string | null;
  priority: string | null;
  deadlineAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): TaskDraft {
  return {
    id: row.id,
    token: row.token,
    status: row.status as TaskDraft["status"],
    step: row.step as TaskDraft["step"],
    createdTaskId: row.createdTaskId,
    sourceChatId: row.sourceChatId,
    sourceMessageId: row.sourceMessageId,
    sourceText: row.sourceText,
    sourceLink: row.sourceLink,
    creatorUserId: row.creatorUserId,
    assigneeId: row.assigneeId,
    priority: row.priority as TaskDraft["priority"],
    deadlineAt: row.deadlineAt,
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
        step: "FINAL",
        createdTaskId: task.id,
        sourceChatId: task.sourceChatId,
        sourceMessageId: task.sourceMessageId,
        sourceText: task.sourceText,
        sourceLink: task.sourceLink,
        creatorUserId: task.creatorUserId,
        assigneeId: task.assigneeUserId,
        priority: task.priority,
        deadlineAt: task.deadlineAt,
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
        step: "CHOOSE_ASSIGNEE",
        sourceChatId: input.sourceChatId,
        sourceMessageId: input.sourceMessageId,
        sourceText: input.sourceText,
        sourceLink: input.sourceLink,
        creatorUserId: input.creatorUserId,
        assigneeId: null,
        priority: null,
        deadlineAt: null
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

  async findTaskBySource(sourceChatId: string, sourceMessageId: string): Promise<Task | null> {
    const row = await prisma.task.findUnique({
      where: {
        sourceChatId_sourceMessageId: {
          sourceChatId,
          sourceMessageId
        }
      }
    });
    return row ? mapTask(row) : null;
  }

  async findAwaitingDeadlineDraftByCreator(creatorUserId: string): Promise<TaskDraft | null> {
    const row = await prisma.taskDraft.findFirst({
      where: {
        creatorUserId,
        status: "PENDING",
        step: "AWAIT_DEADLINE_INPUT"
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    return row ? mapDraft(row) : null;
  }

  async updateDraft(
    draftId: string,
    patch: {
      step?: DraftStep;
      assigneeId?: string | null;
      priority?: Task["priority"] | null;
      deadlineAt?: Date | null;
      status?: "PENDING" | "FINAL";
      createdTaskId?: string | null;
    }
  ): Promise<TaskDraft> {
    const row = await prisma.taskDraft.update({
      where: { id: draftId },
      data: {
        step: patch.step,
        assigneeId: patch.assigneeId,
        priority: patch.priority,
        deadlineAt: patch.deadlineAt,
        status: patch.status,
        createdTaskId: patch.createdTaskId
      }
    });
    return mapDraft(row);
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
          assigneeUserId: draft.assigneeId ?? draft.creatorUserId,
          priority: draft.priority ?? "P2",
          deadlineAt: draft.deadlineAt,
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
        step: "FINAL",
        createdTaskId: taskId
      }
    });
  }
}
