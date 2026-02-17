import type { WorkspaceInviteRepo } from "../ports/workspace-invite.repo.port.js";
import type { WorkspaceRepo } from "../ports/workspace.repo.port.js";
import type {
  WorkspaceResetCounts,
  WorkspaceResetRepo
} from "../ports/workspace-reset.repo.port.js";

export class WorkspaceAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAdminError";
  }
}

export class WorkspaceAdminService {
  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly workspaceInviteRepo: WorkspaceInviteRepo,
    private readonly workspaceResetRepo: WorkspaceResetRepo
  ) {}

  async createWorkspaceManual(title?: string): Promise<{ id: string; title: string | null }> {
    const chatId = `manual:${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const workspace = await this.workspaceRepo.createManual(chatId, title);
    return { id: workspace.id, title: workspace.title };
  }

  async setOwner(
    workspaceId: string,
    userId: string,
    replace = false
  ): Promise<{ id: string; ownerUserId: string | null }> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new WorkspaceAdminError("Workspace not found");
    }
    if (workspace.ownerUserId && workspace.ownerUserId !== userId && !replace) {
      throw new WorkspaceAdminError("Owner already set");
    }
    const updated = await this.workspaceRepo.updateOwner(workspaceId, userId);
    return { id: updated.id, ownerUserId: updated.ownerUserId };
  }

  async createInvite(workspaceId: string, expiresAt: Date | null = null): Promise<{ token: string }> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new WorkspaceAdminError("Workspace not found");
    }
    const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await this.workspaceInviteRepo.createInvite(workspaceId, token, expiresAt);
    return { token };
  }

  async createInviteForLatest(expiresAt: Date | null = null): Promise<{ token: string; workspaceId: string }> {
    const workspace = await this.workspaceRepo.findLatest();
    if (!workspace) {
      throw new WorkspaceAdminError("Workspace not found");
    }
    const invite = await this.createInvite(workspace.id, expiresAt);
    return { token: invite.token, workspaceId: workspace.id };
  }

  async setOwnerForLatest(
    userId: string,
    replace = false
  ): Promise<{ id: string; ownerUserId: string | null }> {
    const workspace = await this.workspaceRepo.findLatest();
    if (!workspace) {
      throw new WorkspaceAdminError("Workspace not found");
    }
    return this.setOwner(workspace.id, userId, replace);
  }

  async isOwner(workspaceId: string, userId: string): Promise<boolean> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      return false;
    }
    return workspace.ownerUserId === userId;
  }

  async getLatestWorkspaceId(): Promise<string | null> {
    const workspace = await this.workspaceRepo.findLatest();
    return workspace?.id ?? null;
  }

  async resetAllWorkspaceData(): Promise<WorkspaceResetCounts> {
    return this.workspaceResetRepo.resetAllWorkspaceData();
  }
}
