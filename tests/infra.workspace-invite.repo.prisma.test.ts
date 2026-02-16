import { describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  workspaceInviteFindFirst: vi.fn()
}));

vi.mock("../src/infra/db/prisma.js", () => ({
  prisma: {
    workspaceInvite: {
      findFirst: prismaMocks.workspaceInviteFindFirst
    }
  }
}));

import { WorkspaceInviteRepoPrisma } from "../src/infra/db/workspace-invite.repo.prisma.js";

describe("WorkspaceInviteRepoPrisma", () => {
  it("findValidByToken returns null when invite missing", async () => {
    prismaMocks.workspaceInviteFindFirst.mockResolvedValueOnce(null);
    const repo = new WorkspaceInviteRepoPrisma();
    const now = new Date("2026-02-16T00:00:00.000Z");

    const result = await repo.findValidByToken("token-1", now);

    expect(prismaMocks.workspaceInviteFindFirst).toHaveBeenCalledWith({
      where: {
        token: "token-1",
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      }
    });
    expect(result).toBeNull();
  });

  it("findValidByToken maps invite row", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const expiresAt = new Date("2026-02-17T00:00:00.000Z");
    prismaMocks.workspaceInviteFindFirst.mockResolvedValueOnce({
      id: "wi-1",
      token: "token-2",
      workspaceId: "ws-1",
      expiresAt,
      createdAt: now
    });
    const repo = new WorkspaceInviteRepoPrisma();

    const result = await repo.findValidByToken("token-2", now);

    expect(result).toEqual({
      id: "wi-1",
      token: "token-2",
      workspaceId: "ws-1",
      expiresAt,
      createdAt: now
    });
  });
});
