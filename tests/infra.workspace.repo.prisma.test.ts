import { describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  workspaceUpsert: vi.fn(),
  workspaceFindUnique: vi.fn()
}));

vi.mock("../src/infra/db/prisma.js", () => ({
  prisma: {
    workspace: {
      upsert: prismaMocks.workspaceUpsert,
      findUnique: prismaMocks.workspaceFindUnique
    }
  }
}));

import { WorkspaceRepoPrisma } from "../src/infra/db/workspace.repo.prisma.js";

describe("WorkspaceRepoPrisma", () => {
  it("ensureByChatId upserts and maps workspace", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    prismaMocks.workspaceUpsert.mockResolvedValueOnce({
      id: "ws-1",
      chatId: "chat-1",
      title: "Team Chat",
      ownerUserId: null,
      createdAt: now,
      updatedAt: now
    });
    const repo = new WorkspaceRepoPrisma();

    const result = await repo.ensureByChatId("chat-1", "Team Chat");

    expect(prismaMocks.workspaceUpsert).toHaveBeenCalledWith({
      where: { chatId: "chat-1" },
      create: { chatId: "chat-1", title: "Team Chat" },
      update: { title: "Team Chat" }
    });
    expect(result).toEqual({
      id: "ws-1",
      chatId: "chat-1",
      title: "Team Chat",
      ownerUserId: null,
      createdAt: now,
      updatedAt: now
    });
  });

  it("findById returns null when workspace missing", async () => {
    prismaMocks.workspaceFindUnique.mockResolvedValueOnce(null);
    const repo = new WorkspaceRepoPrisma();

    const result = await repo.findById("ws-missing");

    expect(result).toBeNull();
  });
});
