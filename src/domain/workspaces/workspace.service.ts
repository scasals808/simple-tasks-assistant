import type { Workspace, WorkspaceRepo } from "../ports/workspace.repo.port.js";

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
  );
}

export class WorkspaceService {
  constructor(private readonly workspaceRepo: WorkspaceRepo) {}

  async findWorkspaceByChatId(chatId: string): Promise<Workspace | null> {
    return this.workspaceRepo.findByChatId(chatId);
  }

  async ensureWorkspaceForChat(chatId: string, title?: string): Promise<Workspace> {
    return (await this.ensureWorkspaceForChatWithResult(chatId, title)).workspace;
  }

  async ensureWorkspaceForChatWithResult(
    chatId: string,
    title?: string
  ): Promise<{ workspace: Workspace; result: "created" | "existing" }> {
    const existing = await this.workspaceRepo.findByChatId(chatId);
    try {
      const workspace = await this.workspaceRepo.ensureByChatId(chatId, title);
      return { workspace, result: existing ? "existing" : "created" };
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      const fallback = await this.workspaceRepo.findByChatId(chatId);
      if (!fallback) {
        throw error;
      }
      return { workspace: fallback, result: "existing" };
    }
  }
}
