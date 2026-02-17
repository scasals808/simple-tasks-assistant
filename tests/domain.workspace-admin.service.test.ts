import { describe, expect, it, vi } from "vitest";

import type { WorkspaceInviteRepo } from "../src/domain/ports/workspace-invite.repo.port.js";
import type { WorkspaceRepo } from "../src/domain/ports/workspace.repo.port.js";
import {
  WorkspaceAdminError,
  WorkspaceAdminService
} from "../src/domain/workspaces/workspace-admin.service.js";

function makeWorkspace(overrides: Partial<{ ownerUserId: string | null }> = {}) {
  return {
    id: "ws-1",
    chatId: "chat-1",
    title: "Team A",
    ownerUserId: null,
    createdAt: new Date("2026-02-16T00:00:00.000Z"),
    updatedAt: new Date("2026-02-16T00:00:00.000Z"),
    ...overrides
  };
}

function makeResetRepo() {
  return {
    resetAllWorkspaceData: vi.fn(async () => ({
      workspaceMembers: 0,
      workspaceInvites: 0,
      workspaces: 0
    }))
  };
}

describe("WorkspaceAdminService", () => {
  it("creates manual workspace", async () => {
    const createManual = vi.fn(async (_chatId: string, title?: string) => makeWorkspace({}));
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual,
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const inviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async (_workspaceId, token) => ({
        id: "wi-1",
        token,
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    };
    const service = new WorkspaceAdminService(workspaceRepo, inviteRepo, makeResetRepo());

    const result = await service.createWorkspaceManual("My Team");

    expect(result.id).toBe("ws-1");
    expect(createManual).toHaveBeenCalledTimes(1);
    expect(createManual.mock.calls[0][0]).toMatch(/^manual:/);
    expect(createManual).toHaveBeenCalledWith(expect.any(String), "My Team");
  });

  it("admin can create invite", async () => {
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const createInvite = vi.fn(async (_workspaceId, token) => ({
      id: "wi-1",
      token,
      workspaceId: "ws-1",
      expiresAt: null,
      createdAt: new Date("2026-02-16T00:00:00.000Z")
    }));
    const inviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite
    };
    const service = new WorkspaceAdminService(workspaceRepo, inviteRepo, makeResetRepo());

    const result = await service.createInvite("ws-1");

    expect(result.token).toBeTruthy();
    expect(createInvite).toHaveBeenCalledTimes(1);
  });

  it("owner cannot be overwritten without explicit replace", async () => {
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace({ ownerUserId: "admin-1" })),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace({ ownerUserId: "admin-2" }))
    };
    const inviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async (_workspaceId, token) => ({
        id: "wi-1",
        token,
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    };
    const service = new WorkspaceAdminService(workspaceRepo, inviteRepo, makeResetRepo());

    await expect(service.setOwner("ws-1", "admin-2", false)).rejects.toBeInstanceOf(
      WorkspaceAdminError
    );
  });

  it("sets owner when workspace owner is empty", async () => {
    const updateOwner = vi.fn(async () => makeWorkspace({ ownerUserId: "executor-1" }));
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace({ ownerUserId: null })),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner
    };
    const inviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async (_workspaceId, token) => ({
        id: "wi-1",
        token,
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    };
    const service = new WorkspaceAdminService(workspaceRepo, inviteRepo, makeResetRepo());

    const result = await service.setOwner("ws-1", "executor-1", false);

    expect(result.ownerUserId).toBe("executor-1");
    expect(updateOwner).toHaveBeenCalledWith("ws-1", "executor-1");
  });

  it("allows owner replace when explicit flag is true", async () => {
    const updateOwner = vi.fn(async () => makeWorkspace({ ownerUserId: "admin-2" }));
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace({ ownerUserId: "admin-1" })),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner
    };
    const inviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async (_workspaceId, token) => ({
        id: "wi-1",
        token,
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    };
    const service = new WorkspaceAdminService(workspaceRepo, inviteRepo, makeResetRepo());

    const result = await service.setOwner("ws-1", "admin-2", true);

    expect(result.ownerUserId).toBe("admin-2");
    expect(updateOwner).toHaveBeenCalledWith("ws-1", "admin-2");
  });

  it("throws when creating invite for missing workspace", async () => {
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => null),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const inviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async (_workspaceId, token) => ({
        id: "wi-1",
        token,
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    };
    const service = new WorkspaceAdminService(workspaceRepo, inviteRepo, makeResetRepo());

    await expect(service.createInvite("missing")).rejects.toBeInstanceOf(WorkspaceAdminError);
  });

  it("throws when no latest workspace for invite and owner flows", async () => {
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => null),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const inviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async (_workspaceId, token) => ({
        id: "wi-1",
        token,
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    };
    const service = new WorkspaceAdminService(workspaceRepo, inviteRepo, makeResetRepo());

    await expect(service.createInviteForLatest()).rejects.toBeInstanceOf(WorkspaceAdminError);
    await expect(service.setOwnerForLatest("admin-1")).rejects.toBeInstanceOf(WorkspaceAdminError);
  });
});
