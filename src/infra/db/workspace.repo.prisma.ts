import type { Workspace, WorkspaceRepo, WorkspaceStatus } from "../../domain/ports/workspace.repo.port.js";
import { prisma } from "./prisma.js";

function mapWorkspace(row: {
  id: string;
  chatId: string;
  title: string | null;
  ownerUserId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: row.id,
    chatId: row.chatId,
    title: row.title,
    ownerUserId: row.ownerUserId,
    status: row.status as WorkspaceStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class WorkspaceRepoPrisma implements WorkspaceRepo {
  async ensureByChatId(chatId: string, title?: string): Promise<Workspace> {
    const row = await prisma.workspace.upsert({
      where: { chatId },
      create: {
        chatId,
        title: title ?? null,
        status: "ACTIVE"
      },
      update: title ? { title } : {}
    });
    return mapWorkspace(row);
  }

  async findById(id: string): Promise<Workspace | null> {
    const row = await prisma.workspace.findUnique({
      where: { id }
    });
    return row ? mapWorkspace(row) : null;
  }

  async findByChatId(chatId: string): Promise<Workspace | null> {
    const row = await prisma.workspace.findUnique({
      where: { chatId }
    });
    return row ? mapWorkspace(row) : null;
  }

  async createManual(chatId: string, title?: string): Promise<Workspace> {
    const row = await prisma.workspace.create({
      data: {
        chatId,
        title: title ?? null
      }
    });
    return mapWorkspace(row);
  }

  async findLatest(): Promise<Workspace | null> {
    const row = await prisma.workspace.findFirst({
      orderBy: {
        createdAt: "desc"
      }
    });
    return row ? mapWorkspace(row) : null;
  }

  async findActiveByOwnerUserId(ownerUserId: string): Promise<Workspace | null> {
    const row = await prisma.workspace.findFirst({
      where: {
        ownerUserId,
        status: "ACTIVE"
      },
      orderBy: {
        createdAt: "desc"
      }
    });
    return row ? mapWorkspace(row) : null;
  }

  async findLatestByOwnerUserId(ownerUserId: string): Promise<Workspace | null> {
    const row = await prisma.workspace.findFirst({
      where: { ownerUserId },
      orderBy: {
        createdAt: "desc"
      }
    });
    return row ? mapWorkspace(row) : null;
  }

  async updateOwner(workspaceId: string, ownerUserId: string | null): Promise<Workspace> {
    const row = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { ownerUserId }
    });
    return mapWorkspace(row);
  }

  async closeWorkspace(workspaceId: string): Promise<Workspace> {
    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.update({
        where: { id: workspaceId },
        data: { status: "ARCHIVED" }
      });
      await tx.workspaceMember.updateMany({
        where: { workspaceId, status: "ACTIVE" },
        data: { status: "REMOVED" }
      });
      return mapWorkspace(workspace);
    });
  }

  async relinkChatIdToWorkspace(chatId: string, targetWorkspaceId: string): Promise<Workspace> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.workspace.findUnique({ where: { chatId } });

      if (current && current.id === targetWorkspaceId) {
        return mapWorkspace(current);
      }
      if (current && current.id !== targetWorkspaceId) {
        await tx.workspace.update({
          where: { id: current.id },
          data: { chatId: `archived:${current.id}` }
        });
      }
      const updatedTarget = await tx.workspace.update({
        where: { id: targetWorkspaceId },
        data: { chatId }
      });
      return mapWorkspace(updatedTarget);
    });
  }
}
