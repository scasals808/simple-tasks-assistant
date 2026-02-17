import { describe, expect, it, vi } from "vitest";

import type { WorkspaceRepo } from "../src/domain/ports/workspace.repo.port.js";
import { WorkspaceService } from "../src/domain/workspaces/workspace.service.js";

describe("WorkspaceService.ensureWorkspaceForChat", () => {
  it("delegates to repo and returns workspace", async () => {
    const expected = {
      id: "ws-1",
      chatId: "chat-1",
      title: "Team Chat",
      ownerUserId: null,
      createdAt: new Date("2026-02-16T00:00:00.000Z"),
      updatedAt: new Date("2026-02-16T00:00:00.000Z")
    };
    const ensureByChatId = vi.fn(async () => expected);
    const findByChatId = vi.fn(async () => null);
    const findById = vi.fn(async () => expected);
    const createManual = vi.fn(async () => expected);
    const findLatest = vi.fn(async () => expected);
    const updateOwner = vi.fn(async () => expected);
    const repo: WorkspaceRepo = {
      ensureByChatId,
      findByChatId,
      findById,
      createManual,
      findLatest,
      updateOwner
    };
    const service = new WorkspaceService(repo);

    const result = await service.ensureWorkspaceForChat("chat-1", "Team Chat");

    expect(ensureByChatId).toHaveBeenCalledWith("chat-1", "Team Chat");
    expect(result).toEqual(expected);
  });

  it("returns existing workspace on unique violation retry path", async () => {
    const existing = {
      id: "ws-existing",
      chatId: "-1001",
      title: "Team Chat",
      ownerUserId: null,
      createdAt: new Date("2026-02-16T00:00:00.000Z"),
      updatedAt: new Date("2026-02-16T00:00:00.000Z")
    };
    const uniqueError = { code: "P2002" };
    const ensureByChatId = vi.fn(async () => {
      throw uniqueError;
    });
    const findByChatId = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const findById = vi.fn(async () => existing);
    const createManual = vi.fn(async () => existing);
    const findLatest = vi.fn(async () => existing);
    const updateOwner = vi.fn(async () => existing);
    const repo: WorkspaceRepo = {
      ensureByChatId,
      findByChatId,
      findById,
      createManual,
      findLatest,
      updateOwner
    };
    const service = new WorkspaceService(repo);

    const result = await service.ensureWorkspaceForChatWithResult("-1001", "Team Chat");

    expect(result.result).toBe("existing");
    expect(result.workspace.id).toBe("ws-existing");
    expect(findByChatId).toHaveBeenCalledTimes(2);
  });
});
