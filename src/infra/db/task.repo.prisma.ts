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
  workspaceId: string | null;
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
    workspaceId: row.workspaceId,
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
    workspaceId?: string | null;
    step?: DraftStep;
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
        step: input.step ?? "CHOOSE_ASSIGNEE",
        workspaceId: input.workspaceId ?? null,
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

  async findByAssigneeUserId(assigneeUserId: string): Promise<Task[]> {
    const rows = await prisma.task.findMany({
      where: { assigneeUserId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map(mapTask);
  }

  async listAssignedTasks(workspaceId: string, viewerUserId: string, limit: number): Promise<Task[]> {
    const rows = await prisma.$queryRaw<
      Array<{
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
      }>
    >(Prisma.sql`
      SELECT
        t."id",
        t."sourceDraftId",
        t."sourceChatId",
        t."sourceMessageId",
        t."sourceText",
        t."sourceLink",
        t."creatorUserId",
        t."assigneeUserId",
        t."priority",
        t."deadlineAt",
        t."status",
        t."createdAt",
        t."updatedAt"
      FROM "Task" t
      WHERE t."workspaceId" = ${workspaceId}
        AND t."assigneeUserId" = ${viewerUserId}
      ORDER BY
        CASE t."priority"
          WHEN 'P1' THEN 1
          WHEN 'P2' THEN 2
          WHEN 'P3' THEN 3
          ELSE 4
        END ASC,
        t."deadlineAt" ASC NULLS LAST,
        t."createdAt" DESC,
        t."id" ASC
      LIMIT ${limit}
    `);
    return rows.map(mapTask);
  }

  async listCreatedTasks(workspaceId: string, viewerUserId: string, limit: number): Promise<Task[]> {
    const rows = await prisma.$queryRaw<
      Array<{
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
      }>
    >(Prisma.sql`
      SELECT
        t."id",
        t."sourceDraftId",
        t."sourceChatId",
        t."sourceMessageId",
        t."sourceText",
        t."sourceLink",
        t."creatorUserId",
        t."assigneeUserId",
        t."priority",
        t."deadlineAt",
        t."status",
        t."createdAt",
        t."updatedAt"
      FROM "Task" t
      WHERE t."workspaceId" = ${workspaceId}
        AND t."creatorUserId" = ${viewerUserId}
      ORDER BY
        CASE t."priority"
          WHEN 'P1' THEN 1
          WHEN 'P2' THEN 2
          WHEN 'P3' THEN 3
          ELSE 4
        END ASC,
        t."deadlineAt" ASC NULLS LAST,
        t."createdAt" DESC,
        t."id" ASC
      LIMIT ${limit}
    `);
    return rows.map(mapTask);
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

  async findDraftByCreatorAndStep(creatorUserId: string, step: DraftStep): Promise<TaskDraft | null> {
    const row = await prisma.taskDraft.findFirst({
      where: {
        creatorUserId,
        status: "PENDING",
        step
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
      sourceText?: string;
      assigneeId?: string | null;
      priority?: Task["priority"] | null;
      deadlineAt?: Date | null;
      status?: "PENDING" | "FINAL";
      createdTaskId?: string | null;
    }
  ): Promise<TaskDraft> {
    const data: {
      step?: DraftStep;
      sourceText?: string;
      assigneeId?: string | null;
      priority?: Task["priority"] | null;
      deadlineAt?: Date | null;
      status?: "PENDING" | "FINAL";
      createdTaskId?: string | null;
    } = {};
    if (patch.step !== undefined) data.step = patch.step;
    if (patch.sourceText !== undefined) data.sourceText = patch.sourceText;
    if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.deadlineAt !== undefined) data.deadlineAt = patch.deadlineAt;
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.createdTaskId !== undefined) data.createdTaskId = patch.createdTaskId;

    const row = await prisma.taskDraft.update({
      where: { id: draftId },
      data
    });
    return mapDraft(row);
  }

  async updateDraftStepIfExpected(
    draftId: string,
    expectedStep: DraftStep,
    patch: {
      step: DraftStep;
      sourceText?: string;
      assigneeId?: string | null;
      priority?: Task["priority"] | null;
      deadlineAt?: Date | null;
    }
  ): Promise<{ updated: boolean; draft: TaskDraft }> {
    const data: {
      step: DraftStep;
      sourceText?: string;
      assigneeId?: string | null;
      priority?: Task["priority"] | null;
      deadlineAt?: Date | null;
    } = { step: patch.step };
    if (patch.sourceText !== undefined) data.sourceText = patch.sourceText;
    if (patch.assigneeId !== undefined) data.assigneeId = patch.assigneeId;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.deadlineAt !== undefined) data.deadlineAt = patch.deadlineAt;

    const result = await prisma.taskDraft.updateMany({
      where: {
        id: draftId,
        step: expectedStep
      },
      data
    });
    const draft = await prisma.taskDraft.findUnique({ where: { id: draftId } });
    if (!draft) {
      throw new Error("Draft not found");
    }
    return { updated: result.count === 1, draft: mapDraft(draft) };
  }

  async createFromDraft(draft: TaskDraft): Promise<CreateFromDraftResult> {
    try {
      const row = await prisma.task.create({
        data: {
          sourceDraftId: draft.id,
          workspaceId: draft.workspaceId,
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
