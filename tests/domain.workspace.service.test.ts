import { describe, expect, it, vi } from "vitest";

import type { WorkspaceRepo } from "../src/domain/ports/workspace.repo.port.js";
import { WorkspaceService } from "../src/domain/workspaces/workspace.service.js";

describe("WorkspaceService.ensureWorkspaceForChat", () => {
  it("delegates to repo and returns workspace", async () => {
    const expected = {
      id: "ws-1",
      chatId: "chat-1",
      title: "Team Chat",
      assignerUserId: null,
      createdAt: new Date("2026-02-16T00:00:00.000Z"),
      updatedAt: new Date("2026-02-16T00:00:00.000Z")
    };
    const ensureByChatId = vi.fn(async () => expected);
    const findById = vi.fn(async () => expected);
    const repo: WorkspaceRepo = { ensureByChatId, findById };
    const service = new WorkspaceService(repo);

    const result = await service.ensureWorkspaceForChat("chat-1", "Team Chat");

    expect(ensureByChatId).toHaveBeenCalledWith("chat-1", "Team Chat");
    expect(result).toEqual(expected);
  });
});
