import { describe, expect, it, vi } from "vitest";

import type { WorkspaceInviteRepo } from "../src/domain/ports/workspace-invite.repo.port.js";
import type { WorkspaceMemberRepo } from "../src/domain/ports/workspace-member.repo.port.js";
import type { WorkspaceRepo } from "../src/domain/ports/workspace.repo.port.js";
import {
  WorkspaceInviteError,
  WorkspaceInviteService
} from "../src/domain/workspaces/workspace-invite.service.js";

function makeWorkspace() {
  return {
    id: "ws-1",
    chatId: "chat-1",
    title: "Team Workspace",
    ownerUserId: null,
    createdAt: new Date("2026-02-16T00:00:00.000Z"),
    updatedAt: new Date("2026-02-16T00:00:00.000Z")
  };
}

describe("WorkspaceInviteService.acceptInvite", () => {
  it("throws error on invalid token", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceInviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        tgFirstName: null,
        tgLastName: null,
        tgUsername: null,
        joinedAt: now,
        lastSeenAt: now
      })),
      findMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null)
    };
    const service = new WorkspaceInviteService(
      { now: () => now },
      workspaceInviteRepo,
      workspaceRepo,
      workspaceMemberRepo
    );

    await expect(service.acceptInvite("bad-token", "u-1")).rejects.toBeInstanceOf(WorkspaceInviteError);
  });

  it("throws error on expired token", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceInviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => null),
      createInvite: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        tgFirstName: null,
        tgLastName: null,
        tgUsername: null,
        joinedAt: now,
        lastSeenAt: now
      })),
      findMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null)
    };
    const service = new WorkspaceInviteService(
      { now: () => now },
      workspaceInviteRepo,
      workspaceRepo,
      workspaceMemberRepo
    );

    await expect(service.acceptInvite("expired-token", "u-1")).rejects.toBeInstanceOf(
      WorkspaceInviteError
    );
  });

  it("creates member on valid token", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceInviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => ({
        id: "wi-1",
        token: "valid-token",
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: now
      })),
      createInvite: vi.fn(async () => ({
        id: "wi-1",
        token: "valid-token",
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: now
      }))
    };
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const upsertMember = vi.fn(async () => ({
      id: "wm-1",
      workspaceId: "ws-1",
      userId: "u-1",
      role: "MEMBER" as const,
      tgFirstName: null,
      tgLastName: null,
      tgUsername: null,
      joinedAt: now,
      lastSeenAt: now
    }));
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember,
      findMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null)
    };
    const service = new WorkspaceInviteService(
      { now: () => now },
      workspaceInviteRepo,
      workspaceRepo,
      workspaceMemberRepo
    );

    const result = await service.acceptInvite("valid-token", "u-1");

    expect(upsertMember).toHaveBeenCalledWith("ws-1", "u-1", "MEMBER", now, undefined);
    expect(result).toEqual({
      workspace: {
        id: "ws-1",
        title: "Team Workspace"
      }
    });
  });

  it("is idempotent on repeated accept (no duplicates)", async () => {
    const firstSeen = new Date("2026-02-16T00:00:00.000Z");
    const secondSeen = new Date("2026-02-16T00:10:00.000Z");
    const workspaceInviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async (_token, now) => ({
        id: "wi-1",
        token: "valid-token",
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: now
      })),
      createInvite: vi.fn(async (_workspaceId, token, _expiresAt) => ({
        id: "wi-1",
        token,
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: firstSeen
      }))
    };
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const upsertMember = vi
      .fn()
      .mockResolvedValueOnce({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER" as const,
        tgFirstName: null,
        tgLastName: null,
        tgUsername: null,
        joinedAt: firstSeen,
        lastSeenAt: firstSeen
      })
      .mockResolvedValueOnce({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER" as const,
        tgFirstName: null,
        tgLastName: null,
        tgUsername: null,
        joinedAt: firstSeen,
        lastSeenAt: secondSeen
      });
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember,
      findMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null)
    };
    const clock = {
      now: vi.fn().mockReturnValueOnce(firstSeen).mockReturnValueOnce(secondSeen)
    };
    const service = new WorkspaceInviteService(
      clock,
      workspaceInviteRepo,
      workspaceRepo,
      workspaceMemberRepo
    );

    await service.acceptInvite("valid-token", "u-1");
    await service.acceptInvite("valid-token", "u-1");

    expect(upsertMember).toHaveBeenNthCalledWith(1, "ws-1", "u-1", "MEMBER", firstSeen, undefined);
    expect(upsertMember).toHaveBeenNthCalledWith(2, "ws-1", "u-1", "MEMBER", secondSeen, undefined);
  });

  it("keeps OWNER role when owner accepts invite", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceInviteRepo: WorkspaceInviteRepo = {
      findValidByToken: vi.fn(async () => ({
        id: "wi-1",
        token: "valid-token",
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: now
      })),
      createInvite: vi.fn(async () => ({
        id: "wi-1",
        token: "valid-token",
        workspaceId: "ws-1",
        expiresAt: null,
        createdAt: now
      }))
    };
    const workspaceRepo: WorkspaceRepo = {
      ensureByChatId: vi.fn(async () => makeWorkspace()),
      findByChatId: vi.fn(async () => makeWorkspace()),
      findById: vi.fn(async () => makeWorkspace()),
      createManual: vi.fn(async () => makeWorkspace()),
      findLatest: vi.fn(async () => makeWorkspace()),
      updateOwner: vi.fn(async () => makeWorkspace())
    };
    const upsertMember = vi.fn(async () => ({
      id: "wm-1",
      workspaceId: "ws-1",
      userId: "owner-1",
      role: "OWNER" as const,
      tgFirstName: null,
      tgLastName: null,
      tgUsername: null,
      joinedAt: now,
      lastSeenAt: now
    }));
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember,
      findMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "owner-1",
        role: "OWNER",
        tgFirstName: null,
        tgLastName: null,
        tgUsername: null,
        joinedAt: now,
        lastSeenAt: now
      })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null)
    };
    const service = new WorkspaceInviteService(
      { now: () => now },
      workspaceInviteRepo,
      workspaceRepo,
      workspaceMemberRepo
    );

    await service.acceptInvite("valid-token", "owner-1");

    expect(upsertMember).toHaveBeenCalledWith("ws-1", "owner-1", "OWNER", now, undefined);
  });
});
