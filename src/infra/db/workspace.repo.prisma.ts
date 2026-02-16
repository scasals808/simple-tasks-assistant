import type { Workspace, WorkspaceRepo } from "../../domain/ports/workspace.repo.port.js";
import { prisma } from "./prisma.js";

function mapWorkspace(row: {
  id: string;
  chatId: string;
  title: string | null;
  assignerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Workspace {
  return {
    id: row.id,
    chatId: row.chatId,
    title: row.title,
    assignerUserId: row.assignerUserId,
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
}
