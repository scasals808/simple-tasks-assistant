import { describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  workspaceMemberUpsert: vi.fn()
}));

vi.mock("../src/infra/db/prisma.js", () => ({
  prisma: {
    workspaceMember: {
      upsert: prismaMocks.workspaceMemberUpsert
    }
  }
}));

import { WorkspaceMemberRepoPrisma } from "../src/infra/db/workspace-member.repo.prisma.js";

describe("WorkspaceMemberRepoPrisma", () => {
  it("upsertMember upserts by workspaceId and userId", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    prismaMocks.workspaceMemberUpsert.mockResolvedValueOnce({
      id: "wm-1",
      workspaceId: "ws-1",
      userId: "u-1",
      role: "EXECUTOR",
      joinedAt: now,
      lastSeenAt: now
    });
    const repo = new WorkspaceMemberRepoPrisma();

    const result = await repo.upsertMember("ws-1", "u-1", "EXECUTOR", now);

    expect(prismaMocks.workspaceMemberUpsert).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: {
          workspaceId: "ws-1",
          userId: "u-1"
        }
      },
      create: {
        workspaceId: "ws-1",
        userId: "u-1",
        role: "EXECUTOR",
        joinedAt: now,
        lastSeenAt: now
      },
      update: {
        role: "EXECUTOR",
        lastSeenAt: now
      }
    });
    expect(result).toMatchObject({
      id: "wm-1",
      workspaceId: "ws-1",
      userId: "u-1",
      role: "EXECUTOR"
    });
  });
});
