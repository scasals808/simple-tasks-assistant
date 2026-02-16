import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  taskCreate: vi.fn(),
  taskFindFirst: vi.fn(),
  taskFindUnique: vi.fn(),
  taskDraftCreate: vi.fn(),
  taskDraftFindUnique: vi.fn(),
  taskDraftFindFirst: vi.fn(),
  taskDraftUpdate: vi.fn(),
  taskDraftUpsert: vi.fn()
}));

vi.mock("../src/infra/db/prisma.js", () => ({
  prisma: {
    task: {
      create: prismaMocks.taskCreate,
      findFirst: prismaMocks.taskFindFirst,
      findUnique: prismaMocks.taskFindUnique
    },
    taskDraft: {
      create: prismaMocks.taskDraftCreate,
      findUnique: prismaMocks.taskDraftFindUnique,
      findFirst: prismaMocks.taskDraftFindFirst,
      update: prismaMocks.taskDraftUpdate,
      upsert: prismaMocks.taskDraftUpsert
    }
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
