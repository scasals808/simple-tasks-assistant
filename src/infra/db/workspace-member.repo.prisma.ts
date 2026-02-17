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
  tgFirstName: string | null;
  tgLastName: string | null;
  tgUsername: string | null;
  joinedAt: Date;
  lastSeenAt: Date;
}): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role as WorkspaceMemberRole,
    tgFirstName: row.tgFirstName,
    tgLastName: row.tgLastName,
    tgUsername: row.tgUsername,
    joinedAt: row.joinedAt,
    lastSeenAt: row.lastSeenAt
  };
}

export class WorkspaceMemberRepoPrisma implements WorkspaceMemberRepo {
  async upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
    lastSeenAt: Date,
    profile?: {
      tgFirstName?: string | null;
      tgLastName?: string | null;
      tgUsername?: string | null;
    }
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
        tgFirstName: profile?.tgFirstName ?? null,
        tgLastName: profile?.tgLastName ?? null,
        tgUsername: profile?.tgUsername ?? null,
        joinedAt: lastSeenAt,
        lastSeenAt
      },
      update: {
        role,
        tgFirstName: profile?.tgFirstName ?? null,
        tgLastName: profile?.tgLastName ?? null,
        tgUsername: profile?.tgUsername ?? null,
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
