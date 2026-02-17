import type { Workspace, WorkspaceRepo } from "../../domain/ports/workspace.repo.port.js";
import { prisma } from "./prisma.js";

function mapWorkspace(row: {
  id: string;
  chatId: string;
  title: string | null;
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: row.id,
    chatId: row.chatId,
    title: row.title,
    ownerUserId: row.ownerUserId,
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
        title: title ?? null
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

  async updateOwner(workspaceId: string, ownerUserId: string | null): Promise<Workspace> {
    const row = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { ownerUserId }
    });
    return mapWorkspace(row);
  }
}
