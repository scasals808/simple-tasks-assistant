import type {
  WorkspaceInvite,
  WorkspaceInviteRepo
} from "../../domain/ports/workspace-invite.repo.port.js";
import { prisma } from "./prisma.js";

function mapWorkspaceInvite(row: {
  id: string;
  token: string;
  workspaceId: string;
  expiresAt: Date | null;
  createdAt: Date;
}): WorkspaceInvite {
  return {
    id: row.id,
    token: row.token,
    workspaceId: row.workspaceId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt
  };
}

export class WorkspaceInviteRepoPrisma implements WorkspaceInviteRepo {
  async findValidByToken(token: string, now: Date): Promise<WorkspaceInvite | null> {
    const row = await prisma.workspaceInvite.findFirst({
      where: {
        token,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }]
      }
    });
    return row ? mapWorkspaceInvite(row) : null;
  }

  async createInvite(
    workspaceId: string,
    token: string,
    expiresAt: Date | null
  ): Promise<WorkspaceInvite> {
    const row = await prisma.workspaceInvite.create({
      data: {
        workspaceId,
        token,
        expiresAt
      }
    });
    return mapWorkspaceInvite(row);
  }
}
