import type { WorkspaceInviteRepo } from "../ports/workspace-invite.repo.port.js";
import type { WorkspaceRepo } from "../ports/workspace.repo.port.js";

export class WorkspaceAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAdminError";
  }
}

export class WorkspaceAdminService {
  constructor(
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly workspaceInviteRepo: WorkspaceInviteRepo
  ) {}

  async createWorkspaceManual(title?: string): Promise<{ id: string; title: string | null }> {
    const chatId = `manual:${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const workspace = await this.workspaceRepo.createManual(chatId, title);
    return { id: workspace.id, title: workspace.title };
  }

  async setAssigner(
    workspaceId: string,
    userId: string,
    replace = false
  ): Promise<{ id: string; assignerUserId: string | null }> {
    const workspace = await this.workspaceRepo.findById(workspaceId);
    if (!workspace) {
      throw new WorkspaceAdminError("Workspace not found");
    }
    if (
      workspace.assignerUserId &&
      workspace.assignerUserId !== userId &&
      !replace
    ) {
      throw new WorkspaceAdminError("Assigner already set");
    }
    const updated = await this.workspaceRepo.updateAssigner(workspaceId, userId);
    return { id: updated.id, assignerUserId: updated.assignerUserId };
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

  async setAssignerForLatest(
    userId: string,
    replace = false
  ): Promise<{ id: string; assignerUserId: string | null }> {
    const workspace = await this.workspaceRepo.findLatest();
    if (!workspace) {
      throw new WorkspaceAdminError("Workspace not found");
    }
    return this.setAssigner(workspace.id, userId, replace);
  }
}
