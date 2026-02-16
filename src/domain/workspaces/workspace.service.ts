import type { Workspace, WorkspaceRepo } from "../ports/workspace.repo.port.js";

export class WorkspaceService {
  constructor(private readonly workspaceRepo: WorkspaceRepo) {}

  async ensureWorkspaceForChat(chatId: string, title?: string): Promise<Workspace> {
    return this.workspaceRepo.ensureByChatId(chatId, title);
  }
}
