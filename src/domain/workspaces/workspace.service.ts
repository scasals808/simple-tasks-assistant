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

  async ensureWorkspaceForUser(userId: string): Promise<Workspace> {
    const activeOwned = await this.workspaceRepo.findActiveByOwnerUserId(userId);
    if (activeOwned) {
      return activeOwned;
    }
    const chatId = `owner:${userId}:${Date.now().toString(36)}`;
    const workspace = await this.workspaceRepo.createManual(chatId);
    if (workspace.ownerUserId === userId && workspace.status === "ACTIVE") {
      return workspace;
    }
    return this.workspaceRepo.updateOwner(workspace.id, userId);
  }

  async closeWorkspace(ownerUserId: string): Promise<
    | { status: "NOT_FOUND" }
    | { status: "ALREADY_CLOSED" }
    | { status: "CLOSED"; changed: boolean; workspace: Workspace }
  > {
    const activeOwned = await this.workspaceRepo.findActiveByOwnerUserId(ownerUserId);
    if (!activeOwned) {
      const latestOwned = await this.workspaceRepo.findLatestByOwnerUserId(ownerUserId);
      if (latestOwned?.status === "ARCHIVED") {
        return { status: "ALREADY_CLOSED" };
      }
      return { status: "NOT_FOUND" };
    }
    const workspace = await this.workspaceRepo.closeWorkspace(activeOwned.id);
    return { status: "CLOSED", changed: true, workspace };
  }

  async findWorkspaceById(id: string): Promise<Workspace | null> {
    return this.workspaceRepo.findById(id);
  }

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

  async relinkArchivedChatToOwnerActiveWorkspace(
    chatId: string,
    userId: string
  ): Promise<
    | { status: "RELINKED"; workspace: Workspace }
    | { status: "NOT_ALLOWED" }
    | { status: "NO_ACTIVE_OWNED" }
    | { status: "CHAT_ACTIVE"; workspace: Workspace }
    | { status: "CHAT_NOT_FOUND" }
  > {
    const current = await this.workspaceRepo.findByChatId(chatId);
    if (!current) {
      return { status: "CHAT_NOT_FOUND" };
    }
    if (current.status === "ACTIVE") {
      return { status: "CHAT_ACTIVE", workspace: current };
    }
    if (current.ownerUserId !== userId) {
      return { status: "NOT_ALLOWED" };
    }
    const activeOwned = await this.workspaceRepo.findActiveByOwnerUserId(userId);
    if (!activeOwned) {
      return { status: "NO_ACTIVE_OWNED" };
    }
    const relinked = await this.workspaceRepo.relinkChatIdToWorkspace(chatId, activeOwned.id);
    return { status: "RELINKED", workspace: relinked };
  }
}
