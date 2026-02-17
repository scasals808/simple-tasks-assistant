import { describe, expect, it, vi } from "vitest";

import type { WorkspaceMemberRepo } from "../src/domain/ports/workspace-member.repo.port.js";
import { WorkspaceMemberService } from "../src/domain/workspaces/workspace-member.service.js";

describe("WorkspaceMemberService", () => {
  it("creates member first time", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const upsertMember = vi.fn(async () => ({
      id: "wm-1",
      workspaceId: "ws-1",
      userId: "u-1",
      role: "MEMBER" as const,
      joinedAt: now,
      lastSeenAt: now
    }));
    const repo: WorkspaceMemberRepo = {
      upsertMember,
      findMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null)
    };
    const service = new WorkspaceMemberService({ now: () => now }, repo);

    const result = await service.upsertMemberRole("ws-1", "u-1");

    expect(upsertMember).toHaveBeenCalledWith("ws-1", "u-1", "MEMBER", now);
    expect(result).toMatchObject({
      workspaceId: "ws-1",
      userId: "u-1",
      role: "MEMBER"
    });
  });

  it("is idempotent and updates lastSeenAt on second call", async () => {
    const firstSeen = new Date("2026-02-16T00:00:00.000Z");
    const secondSeen = new Date("2026-02-16T00:10:00.000Z");
    const upsertMember = vi
      .fn()
      .mockResolvedValueOnce({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER" as const,
        joinedAt: firstSeen,
        lastSeenAt: firstSeen
      })
      .mockResolvedValueOnce({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER" as const,
        joinedAt: firstSeen,
        lastSeenAt: secondSeen
      });
    const repo: WorkspaceMemberRepo = {
      upsertMember,
      findMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null)
    };
    const clock = {
      now: vi.fn().mockReturnValueOnce(firstSeen).mockReturnValueOnce(secondSeen)
    };
    const service = new WorkspaceMemberService(clock, repo);

    const first = await service.upsertMemberRole("ws-1", "u-1");
    const second = await service.upsertMemberRole("ws-1", "u-1");

    expect(first.id).toBe("wm-1");
    expect(second.id).toBe("wm-1");
    expect(second.lastSeenAt).toEqual(secondSeen);
    expect(upsertMember).toHaveBeenNthCalledWith(1, "ws-1", "u-1", "MEMBER", firstSeen);
    expect(upsertMember).toHaveBeenNthCalledWith(2, "ws-1", "u-1", "MEMBER", secondSeen);
  });
});
