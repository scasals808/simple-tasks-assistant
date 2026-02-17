import { Prisma } from "@prisma/client";

import type {
  CreateFromDraftResult,
  DraftStep,
  TaskDraft,
  TaskReviewDraft,
  TaskRepo
} from "../../domain/ports/task.repo.port.js";
import type { Task } from "../../domain/tasks/task.types.js";
import { prisma } from "./prisma.js";

function mapTask(row: {
  id: string;
  sourceDraftId: string;
  workspaceId: string | null;
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
  assigneeUserId: string;
  priority: string;
  deadlineAt: Date | null;
  status: string;
  submittedForReviewAt: Date | null;
  lastReturnComment?: string | null;
  lastReturnAt?: Date | null;
  lastReturnByUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Task {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    sourceChatId: row.sourceChatId,
    sourceMessageId: row.sourceMessageId,
    sourceText: row.sourceText,
    sourceLink: row.sourceLink,
    creatorUserId: row.creatorUserId,
    assigneeUserId: row.assigneeUserId,
    priority: row.priority as Task["priority"],
    deadlineAt: row.deadlineAt,
    status: row.status as Task["status"],
    submittedForReviewAt: row.submittedForReviewAt,
    lastReturnComment: row.lastReturnComment ?? null,
    lastReturnAt: row.lastReturnAt ?? null,
    lastReturnByUserId: row.lastReturnByUserId ?? null,
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

function mapReviewDraft(row: {
  id: string;
  taskId: string;
  actorUserId: string;
  nonce: string;
  step: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): TaskReviewDraft {
  return {
    id: row.id,
    taskId: row.taskId,
    actorUserId: row.actorUserId,
    nonce: row.nonce,
    step: row.step as TaskReviewDraft["step"],
    status: row.status as TaskReviewDraft["status"],
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
  async upsertActiveReturnCommentDraft(input: {
    taskId: string;
    actorUserId: string;
    nonce: string;
  }): Promise<TaskReviewDraft> {
    await prisma.taskReviewDraft.updateMany({
      where: {
        actorUserId: input.actorUserId,
        status: "ACTIVE"
      },
      data: {
        status: "CLOSED"
      }
    });
    const row = await prisma.taskReviewDraft.create({
      data: {
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        nonce: input.nonce,
        step: "AWAIT_RETURN_COMMENT",
        status: "ACTIVE"
      }
    });
    return mapReviewDraft(row);
  }

  async findActiveReturnCommentDraftByActor(actorUserId: string): Promise<TaskReviewDraft | null> {
    const row = await prisma.taskReviewDraft.findFirst({
      where: {
        actorUserId,
        status: "ACTIVE",
        step: "AWAIT_RETURN_COMMENT"
      },
      orderBy: {
        updatedAt: "desc"
      }
    });
    return row ? mapReviewDraft(row) : null;
  }

  async closeReviewDraft(draftId: string): Promise<void> {
    await prisma.taskReviewDraft.update({
      where: { id: draftId },
      data: { status: "CLOSED" }
    });
  }

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
        workspaceId: task.workspaceId,
        sourceChatId: task.sourceChatId,
        sourceMessageId: task.sourceMessageId,
        sourceText: task.sourceText,
        sourceLink: task.sourceLink,
        creatorUserId: task.creatorUserId,
        assigneeUserId: task.assigneeUserId,
        priority: task.priority,
        deadlineAt: task.deadlineAt,
        status: task.status,
        submittedForReviewAt: task.submittedForReviewAt,
        lastReturnComment: task.lastReturnComment,
        lastReturnAt: task.lastReturnAt,
        lastReturnByUserId: task.lastReturnByUserId,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }
    });

    return mapTask(row);
  }

  async findById(taskId: string): Promise<Task | null> {
    const row = await prisma.task.findUnique({
      where: { id: taskId }
    });
    return row ? mapTask(row) : null;
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

  async findPendingDraftBySource(
    sourceChatId: string,
    sourceMessageId: string,
    creatorUserId: string
  ): Promise<TaskDraft | null> {
    const row = await prisma.taskDraft.findFirst({
      where: {
        sourceChatId,
        sourceMessageId,
        creatorUserId,
        status: "PENDING"
      },
      orderBy: {
        updatedAt: "desc"
      }
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
        workspaceId: string | null;
        sourceChatId: string;
        sourceMessageId: string;
        sourceText: string;
        sourceLink: string | null;
        creatorUserId: string;
        assigneeUserId: string;
        priority: string;
        deadlineAt: Date | null;
        status: string;
        submittedForReviewAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        t."id",
        t."sourceDraftId",
        t."workspaceId",
        t."sourceChatId",
        t."sourceMessageId",
        t."sourceText",
        t."sourceLink",
        t."creatorUserId",
        t."assigneeUserId",
        t."priority",
        t."deadlineAt",
        t."status",
        t."submittedForReviewAt",
        t."createdAt",
        t."updatedAt"
      FROM "Task" t
      WHERE t."workspaceId" = ${workspaceId}
        AND t."assigneeUserId" = ${viewerUserId}
        AND t."status" <> 'CLOSED'
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
        workspaceId: string | null;
        sourceChatId: string;
        sourceMessageId: string;
        sourceText: string;
        sourceLink: string | null;
        creatorUserId: string;
        assigneeUserId: string;
        priority: string;
        deadlineAt: Date | null;
        status: string;
        submittedForReviewAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        t."id",
        t."sourceDraftId",
        t."workspaceId",
        t."sourceChatId",
        t."sourceMessageId",
        t."sourceText",
        t."sourceLink",
        t."creatorUserId",
        t."assigneeUserId",
        t."priority",
        t."deadlineAt",
        t."status",
        t."submittedForReviewAt",
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

  async listOnReviewTasks(workspaceId: string, limit: number): Promise<Task[]> {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        sourceDraftId: string;
        workspaceId: string | null;
        sourceChatId: string;
        sourceMessageId: string;
        sourceText: string;
        sourceLink: string | null;
        creatorUserId: string;
        assigneeUserId: string;
        priority: string;
        deadlineAt: Date | null;
        status: string;
        submittedForReviewAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(Prisma.sql`
      SELECT
        t."id",
        t."sourceDraftId",
        t."workspaceId",
        t."sourceChatId",
        t."sourceMessageId",
        t."sourceText",
        t."sourceLink",
        t."creatorUserId",
        t."assigneeUserId",
        t."priority",
        t."deadlineAt",
        t."status",
        t."submittedForReviewAt",
        t."createdAt",
        t."updatedAt"
      FROM "Task" t
      WHERE t."workspaceId" = ${workspaceId}
        AND t."status" = 'ON_REVIEW'
      ORDER BY
        CASE t."priority"
          WHEN 'P1' THEN 1
          WHEN 'P2' THEN 2
          WHEN 'P3' THEN 3
          ELSE 4
        END ASC,
        t."deadlineAt" ASC NULLS LAST,
        t."createdAt" ASC,
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
          status: "ACTIVE",
          submittedForReviewAt: null,
          lastReturnComment: null,
          lastReturnAt: null,
          lastReturnByUserId: null
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

  async submitForReviewTransactional(
    taskId: string,
    actorUserId: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "NOT_ASSIGNEE" }
    | { status: "ALREADY_ON_REVIEW" }
    | { status: "NONCE_EXISTS" }
    | { status: "SUCCESS"; task: Task }
  > {
    return await prisma.$transaction(async (tx) => {
      // Check if nonce already exists
      const existingAction = await tx.taskAction.findUnique({
        where: { nonce }
      });
      if (existingAction) {
        return { status: "NONCE_EXISTS" as const };
      }

      // SELECT FOR UPDATE to lock the task
      const task = await tx.task.findUnique({
        where: { id: taskId }
      });
      
      if (!task) {
        return { status: "NOT_FOUND" as const };
      }

      // Check actor is assignee
      if (task.assigneeUserId !== actorUserId) {
        return { status: "NOT_ASSIGNEE" as const };
      }

      // Check current status (idempotent if already ON_REVIEW)
      if (task.status === "ON_REVIEW") {
        return { status: "ALREADY_ON_REVIEW" as const };
      }

      // Verify status is ACTIVE
      if (task.status !== "ACTIVE") {
        return { status: "NOT_FOUND" as const };
      }

      const now = new Date();

      // Create TaskAction record
      await tx.taskAction.create({
        data: {
          taskId,
          actorUserId,
          type: "SUBMIT_FOR_REVIEW",
          nonce
        }
      });

      // Update task status
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: "ON_REVIEW",
          submittedForReviewAt: now,
          updatedAt: now
        }
      });

      return { status: "SUCCESS" as const, task: mapTask(updatedTask) };
    });
  }

  async completeTaskTransactional(
    taskId: string,
    actorUserId: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "NOT_ASSIGNEE" }
    | { status: "SUCCESS"; mode: "self_closed" | "review"; changed: boolean; task: Task }
  > {
    return await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          sourceDraftId: string;
          workspaceId: string | null;
          sourceChatId: string;
          sourceMessageId: string;
          sourceText: string;
          sourceLink: string | null;
          creatorUserId: string;
          assigneeUserId: string;
          priority: string;
          deadlineAt: Date | null;
          status: string;
          submittedForReviewAt: Date | null;
          lastReturnComment: string | null;
          lastReturnAt: Date | null;
          lastReturnByUserId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(Prisma.sql`
        SELECT
          t."id",
          t."sourceDraftId",
          t."workspaceId",
          t."sourceChatId",
          t."sourceMessageId",
          t."sourceText",
          t."sourceLink",
          t."creatorUserId",
          t."assigneeUserId",
          t."priority",
          t."deadlineAt",
          t."status",
          t."submittedForReviewAt",
          t."lastReturnComment",
          t."lastReturnAt",
          t."lastReturnByUserId",
          t."createdAt",
          t."updatedAt"
        FROM "Task" t
        WHERE t."id" = ${taskId}
        FOR UPDATE
      `);
      const task = lockedRows[0];
      if (!task) {
        return { status: "NOT_FOUND" as const };
      }
      if (task.assigneeUserId !== actorUserId) {
        return { status: "NOT_ASSIGNEE" as const };
      }

      const mode = task.creatorUserId === task.assigneeUserId ? "self_closed" : "review";
      const existingAction = await tx.taskAction.findUnique({
        where: { nonce }
      });
      if (existingAction) {
        return { status: "SUCCESS" as const, mode, changed: false, task: mapTask(task) };
      }
      if (task.status !== "ACTIVE") {
        return { status: "SUCCESS" as const, mode, changed: false, task: mapTask(task) };
      }

      const now = new Date();
      if (mode === "self_closed") {
        await tx.taskAction.create({
          data: {
            taskId,
            actorUserId,
            type: "SELF_CLOSE",
            nonce
          }
        });
        const updatedTask = await tx.task.update({
          where: { id: taskId },
          data: {
            status: "CLOSED",
            updatedAt: now
          }
        });
        return { status: "SUCCESS" as const, mode, changed: true, task: mapTask(updatedTask) };
      }

      await tx.taskAction.create({
        data: {
          taskId,
          actorUserId,
          type: "SUBMIT_FOR_REVIEW",
          nonce
        }
      });
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: "ON_REVIEW",
          submittedForReviewAt: now,
          updatedAt: now
        }
      });
      return { status: "SUCCESS" as const, mode, changed: true, task: mapTask(updatedTask) };
    });
  }

  async acceptReviewTransactional(
    taskId: string,
    actorUserId: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "SUCCESS"; task: Task }
  > {
    return await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          sourceDraftId: string;
          workspaceId: string | null;
          sourceChatId: string;
          sourceMessageId: string;
          sourceText: string;
          sourceLink: string | null;
          creatorUserId: string;
          assigneeUserId: string;
          priority: string;
          deadlineAt: Date | null;
          status: string;
          submittedForReviewAt: Date | null;
          lastReturnComment: string | null;
          lastReturnAt: Date | null;
          lastReturnByUserId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(Prisma.sql`
        SELECT
          t."id",
          t."sourceDraftId",
          t."workspaceId",
          t."sourceChatId",
          t."sourceMessageId",
          t."sourceText",
          t."sourceLink",
          t."creatorUserId",
          t."assigneeUserId",
          t."priority",
          t."deadlineAt",
          t."status",
          t."submittedForReviewAt",
          t."lastReturnComment",
          t."lastReturnAt",
          t."lastReturnByUserId",
          t."createdAt",
          t."updatedAt"
        FROM "Task" t
        WHERE t."id" = ${taskId}
        FOR UPDATE
      `);
      const task = lockedRows[0];
      if (!task) {
        return { status: "NOT_FOUND" as const };
      }
      if (!task.workspaceId) {
        return { status: "FORBIDDEN" as const };
      }
      const workspace = await tx.workspace.findUnique({
        where: { id: task.workspaceId },
        select: { ownerUserId: true }
      });
      if (!workspace?.ownerUserId || workspace.ownerUserId !== actorUserId) {
        return { status: "FORBIDDEN" as const };
      }

      const existingAction = await tx.taskAction.findUnique({
        where: { nonce }
      });
      if (existingAction) {
        return { status: "SUCCESS" as const, task: mapTask(task) };
      }
      if (task.status !== "ON_REVIEW") {
        return { status: "SUCCESS" as const, task: mapTask(task) };
      }

      await tx.taskAction.create({
        data: {
          taskId,
          actorUserId,
          type: "ACCEPT_REVIEW",
          nonce
        }
      });
      const now = new Date();
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: "CLOSED",
          updatedAt: now
        }
      });
      return { status: "SUCCESS" as const, task: mapTask(updatedTask) };
    });
  }

  async returnToWorkTransactional(
    taskId: string,
    actorUserId: string,
    comment: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "SUCCESS"; task: Task }
  > {
    return await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          sourceDraftId: string;
          workspaceId: string | null;
          sourceChatId: string;
          sourceMessageId: string;
          sourceText: string;
          sourceLink: string | null;
          creatorUserId: string;
          assigneeUserId: string;
          priority: string;
          deadlineAt: Date | null;
          status: string;
          submittedForReviewAt: Date | null;
          lastReturnComment: string | null;
          lastReturnAt: Date | null;
          lastReturnByUserId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(Prisma.sql`
        SELECT
          t."id",
          t."sourceDraftId",
          t."workspaceId",
          t."sourceChatId",
          t."sourceMessageId",
          t."sourceText",
          t."sourceLink",
          t."creatorUserId",
          t."assigneeUserId",
          t."priority",
          t."deadlineAt",
          t."status",
          t."submittedForReviewAt",
          t."lastReturnComment",
          t."lastReturnAt",
          t."lastReturnByUserId",
          t."createdAt",
          t."updatedAt"
        FROM "Task" t
        WHERE t."id" = ${taskId}
        FOR UPDATE
      `);
      const task = lockedRows[0];
      if (!task) {
        return { status: "NOT_FOUND" as const };
      }
      if (!task.workspaceId) {
        return { status: "FORBIDDEN" as const };
      }
      const workspace = await tx.workspace.findUnique({
        where: { id: task.workspaceId },
        select: { ownerUserId: true }
      });
      if (!workspace?.ownerUserId || workspace.ownerUserId !== actorUserId) {
        return { status: "FORBIDDEN" as const };
      }

      const existingAction = await tx.taskAction.findUnique({
        where: { nonce }
      });
      if (existingAction) {
        return { status: "SUCCESS" as const, task: mapTask(task) };
      }
      if (task.status !== "ON_REVIEW") {
        return { status: "SUCCESS" as const, task: mapTask(task) };
      }

      const now = new Date();
      await tx.taskAction.create({
        data: {
          taskId,
          actorUserId,
          type: "RETURN_TO_WORK",
          nonce
        }
      });
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          status: "ACTIVE",
          submittedForReviewAt: null,
          lastReturnComment: comment,
          lastReturnAt: now,
          lastReturnByUserId: actorUserId,
          updatedAt: now
        }
      });
      return { status: "SUCCESS" as const, task: mapTask(updatedTask) };
    });
  }

  async reassignTaskTransactional(
    taskId: string,
    actorUserId: string,
    newAssigneeId: string,
    nonce: string
  ): Promise<
    | { status: "NOT_FOUND" }
    | { status: "FORBIDDEN" }
    | { status: "INVALID_ASSIGNEE" }
    | { status: "TASK_CLOSED" }
    | { status: "SUCCESS"; changed: boolean; task: Task }
  > {
    return await prisma.$transaction(async (tx) => {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          sourceDraftId: string;
          workspaceId: string | null;
          sourceChatId: string;
          sourceMessageId: string;
          sourceText: string;
          sourceLink: string | null;
          creatorUserId: string;
          assigneeUserId: string;
          priority: string;
          deadlineAt: Date | null;
          status: string;
          submittedForReviewAt: Date | null;
          lastReturnComment: string | null;
          lastReturnAt: Date | null;
          lastReturnByUserId: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>
      >(Prisma.sql`
        SELECT
          t."id",
          t."sourceDraftId",
          t."workspaceId",
          t."sourceChatId",
          t."sourceMessageId",
          t."sourceText",
          t."sourceLink",
          t."creatorUserId",
          t."assigneeUserId",
          t."priority",
          t."deadlineAt",
          t."status",
          t."submittedForReviewAt",
          t."lastReturnComment",
          t."lastReturnAt",
          t."lastReturnByUserId",
          t."createdAt",
          t."updatedAt"
        FROM "Task" t
        WHERE t."id" = ${taskId}
        FOR UPDATE
      `);
      const task = lockedRows[0];
      if (!task) {
        return { status: "NOT_FOUND" as const };
      }
      if (!task.workspaceId) {
        return { status: "FORBIDDEN" as const };
      }
      const workspace = await tx.workspace.findUnique({
        where: { id: task.workspaceId },
        select: { ownerUserId: true }
      });
      if (!workspace?.ownerUserId || workspace.ownerUserId !== actorUserId) {
        return { status: "FORBIDDEN" as const };
      }
      if (task.status === "CLOSED") {
        return { status: "TASK_CLOSED" as const };
      }
      const newAssignee = await tx.workspaceMember.findFirst({
        where: {
          workspaceId: task.workspaceId,
          userId: newAssigneeId,
          status: "ACTIVE"
        }
      });
      if (!newAssignee) {
        return { status: "INVALID_ASSIGNEE" as const };
      }
      const existingAction = await tx.taskAction.findUnique({
        where: { nonce }
      });
      if (existingAction) {
        return { status: "SUCCESS" as const, changed: false, task: mapTask(task) };
      }
      if (task.assigneeUserId === newAssigneeId) {
        await tx.taskAction.create({
          data: {
            taskId,
            actorUserId,
            type: "REASSIGN",
            nonce
          }
        });
        return { status: "SUCCESS" as const, changed: false, task: mapTask(task) };
      }
      await tx.taskAction.create({
        data: {
          taskId,
          actorUserId,
          type: "REASSIGN",
          nonce
        }
      });
      const now = new Date();
      const updatedTask = await tx.task.update({
        where: { id: taskId },
        data: {
          assigneeUserId: newAssigneeId,
          updatedAt: now
        }
      });
      return { status: "SUCCESS" as const, changed: true, task: mapTask(updatedTask) };
    });
  }
}
