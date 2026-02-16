import { describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  pendingDeletionCreate: vi.fn(),
  pendingDeletionFindMany: vi.fn(),
  pendingDeletionUpdate: vi.fn()
}));

vi.mock("../src/infra/db/prisma.js", () => ({
  prisma: {
    pendingDeletion: {
      create: prismaMocks.pendingDeletionCreate,
      findMany: prismaMocks.pendingDeletionFindMany,
      update: prismaMocks.pendingDeletionUpdate
    }
  }
}));

import { PendingDeletionRepoPrisma } from "../src/infra/db/pendingDeletion.repo.prisma.js";

describe("PendingDeletionRepoPrisma", () => {
  it("schedule writes expected payload", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    prismaMocks.pendingDeletionCreate.mockResolvedValueOnce({
      id: "pd-1",
      chatId: "1",
      messageId: "2",
      deleteAfterAt: now,
      status: "PENDING",
      attempts: 0,
      lastError: null,
      createdAt: now,
      updatedAt: now
    });
    const repo = new PendingDeletionRepoPrisma();
    await repo.schedule("1", "2", now);
    expect(prismaMocks.pendingDeletionCreate).toHaveBeenCalledWith({
      data: { chatId: "1", messageId: "2", deleteAfterAt: now }
    });
  });

  it("findDue filters by pending and lte now", async () => {
    prismaMocks.pendingDeletionFindMany.mockResolvedValueOnce([]);
    const repo = new PendingDeletionRepoPrisma();
    const now = new Date("2026-02-16T00:00:00.000Z");
    await repo.findDue(now, 10);
    expect(prismaMocks.pendingDeletionFindMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        deleteAfterAt: {
          lte: now
        }
      },
      orderBy: {
        deleteAfterAt: "asc"
      },
      take: 10
    });
  });

  it("markDone and markFailed update status and attempts", async () => {
    prismaMocks.pendingDeletionUpdate.mockResolvedValue(undefined);
    const repo = new PendingDeletionRepoPrisma();
    await repo.markDone("pd-1");
    await repo.markFailed("pd-2", "boom");
    expect(prismaMocks.pendingDeletionUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: "pd-1" },
      data: {
        status: "DONE",
        attempts: { increment: 1 },
        lastError: null
      }
    });
    expect(prismaMocks.pendingDeletionUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "pd-2" },
      data: {
        status: "FAILED",
        attempts: { increment: 1 },
        lastError: "boom"
      }
    });
  });
});
