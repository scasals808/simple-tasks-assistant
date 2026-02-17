import type {
  WorkspaceMember,
  WorkspaceMemberRepo,
  WorkspaceMemberRole
} from "../../domain/ports/workspace-member.repo.port.js";
import { prisma } from "./prisma.js";

function mapWorkspaceMember(row: {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: Date;
  lastSeenAt: Date;
}): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role as WorkspaceMemberRole,
    joinedAt: row.joinedAt,
    lastSeenAt: row.lastSeenAt
  };
}

export class WorkspaceMemberRepoPrisma implements WorkspaceMemberRepo {
  async upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
    lastSeenAt: Date
  ): Promise<WorkspaceMember> {
    const row = await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      },
      create: {
        workspaceId,
        userId,
        role,
        joinedAt: lastSeenAt,
        lastSeenAt
      },
      update: {
        role,
        lastSeenAt
      }
    });
    return mapWorkspaceMember(row);
  }

  async findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const row = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId
        }
      }
    });
    return row ? mapWorkspaceMember(row) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {
    const rows = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: [{ role: "asc" }, { joinedAt: "asc" }]
    });
    return rows.map(mapWorkspaceMember);
  }

  async findLatestWorkspaceIdByUser(userId: string): Promise<string | null> {
    const row = await prisma.workspaceMember.findFirst({
      where: { userId },
      orderBy: [{ lastSeenAt: "desc" }, { joinedAt: "desc" }]
    });
    return row?.workspaceId ?? null;
  }
}
