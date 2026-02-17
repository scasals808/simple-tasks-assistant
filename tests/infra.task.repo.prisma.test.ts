import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  taskCreate: vi.fn(),
  taskFindFirst: vi.fn(),
  taskFindMany: vi.fn(),
  taskFindUnique: vi.fn(),
  taskDraftCreate: vi.fn(),
  taskDraftFindUnique: vi.fn(),
  taskDraftFindFirst: vi.fn(),
  taskDraftUpdate: vi.fn(),
  taskDraftUpsert: vi.fn(),
  queryRaw: vi.fn()
}));

vi.mock("../src/infra/db/prisma.js", () => ({
  prisma: {
    task: {
      create: prismaMocks.taskCreate,
      findFirst: prismaMocks.taskFindFirst,
      findMany: prismaMocks.taskFindMany,
      findUnique: prismaMocks.taskFindUnique
    },
    taskDraft: {
      create: prismaMocks.taskDraftCreate,
      findUnique: prismaMocks.taskDraftFindUnique,
      findFirst: prismaMocks.taskDraftFindFirst,
      update: prismaMocks.taskDraftUpdate,
      upsert: prismaMocks.taskDraftUpsert
    },
    $queryRaw: prismaMocks.queryRaw
  }
}));

import { PrismaTaskRepo } from "../src/infra/db/task.repo.prisma.js";

function makeDraft() {
  return {
    id: "d-1",
    token: "t-1",
    status: "PENDING",
    step: "CONFIRM",
    createdTaskId: null,
    workspaceId: "ws-1",
    sourceChatId: "chat-1",
    sourceMessageId: "msg-1",
    sourceText: "text",
    sourceLink: null,
    creatorUserId: "u-1",
    assigneeId: "maria",
    priority: "P1",
    deadlineAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("PrismaTaskRepo.createFromDraft", () => {
  it("returns ALREADY_EXISTS on unique violation", async () => {
    const err = Object.create(Prisma.PrismaClientKnownRequestError.prototype) as Prisma.PrismaClientKnownRequestError;
    (err as { code: string }).code = "P2002";

    prismaMocks.taskCreate.mockRejectedValueOnce(err);
    prismaMocks.taskFindFirst.mockResolvedValueOnce({
      id: "task-existing",
      sourceDraftId: "d-1",
      sourceChatId: "chat-1",
      sourceMessageId: "msg-1",
      sourceText: "text",
      sourceLink: null,
      creatorUserId: "u-1",
      assigneeUserId: "maria",
      priority: "P1",
      deadlineAt: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const repo = new PrismaTaskRepo();
    const result = await repo.createFromDraft(makeDraft());
    expect(result.status).toBe("ALREADY_EXISTS");
    expect(result.task.id).toBe("task-existing");
  });
});

describe("PrismaTaskRepo.updateDraft", () => {
  it("omits undefined fields from prisma update data", async () => {
    prismaMocks.taskDraftUpdate.mockResolvedValueOnce(makeDraft());

    const repo = new PrismaTaskRepo();
    await repo.updateDraft("d-1", {
      step: "CHOOSE_PRIORITY",
      assigneeId: undefined,
      priority: null
    });

    expect(prismaMocks.taskDraftUpdate).toHaveBeenCalledTimes(1);
    expect(prismaMocks.taskDraftUpdate).toHaveBeenCalledWith({
      where: { id: "d-1" },
      data: {
        step: "CHOOSE_PRIORITY",
        priority: null
      }
    });
  });
});

describe("PrismaTaskRepo list sorting queries", () => {
  it("uses deterministic ORDER BY for assigned tasks", async () => {
    prismaMocks.queryRaw.mockReset();
    prismaMocks.queryRaw.mockResolvedValueOnce([]);
    const repo = new PrismaTaskRepo();

    await repo.listAssignedTasks("ws-1", "u-1", 20);

    expect(prismaMocks.queryRaw).toHaveBeenCalledTimes(1);
    const sqlArg = prismaMocks.queryRaw.mock.calls[0]?.[0] as { strings?: string[] };
    const sql = Array.isArray(sqlArg?.strings) ? sqlArg.strings.join(" ") : String(sqlArg ?? "");
    expect(sql).toContain(`CASE t."priority"`);
    expect(sql).toContain(`t."deadlineAt" ASC NULLS LAST`);
    expect(sql).toContain(`t."createdAt" DESC`);
    expect(sql).toContain(`t."id" ASC`);
  });

  it("uses deterministic ORDER BY for created tasks", async () => {
    prismaMocks.queryRaw.mockReset();
    prismaMocks.queryRaw.mockResolvedValueOnce([]);
    const repo = new PrismaTaskRepo();

    await repo.listCreatedTasks("ws-1", "u-1", 20);

    expect(prismaMocks.queryRaw).toHaveBeenCalledTimes(1);
    const sqlArg = prismaMocks.queryRaw.mock.calls[0]?.[0] as { strings?: string[] };
    const sql = Array.isArray(sqlArg?.strings) ? sqlArg.strings.join(" ") : String(sqlArg ?? "");
    expect(sql).toContain(`CASE t."priority"`);
    expect(sql).toContain(`t."deadlineAt" ASC NULLS LAST`);
    expect(sql).toContain(`t."createdAt" DESC`);
    expect(sql).toContain(`t."id" ASC`);
  });
});
