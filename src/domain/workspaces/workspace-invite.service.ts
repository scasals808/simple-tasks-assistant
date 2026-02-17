import type { Clock } from "../ports/clock.port.js";
import type { WorkspaceInviteRepo } from "../ports/workspace-invite.repo.port.js";
import type { WorkspaceMemberRepo } from "../ports/workspace-member.repo.port.js";
import type { WorkspaceRepo } from "../ports/workspace.repo.port.js";

export class WorkspaceInviteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceInviteError";
  }
}

export type AcceptInviteResult = {
  workspace: {
    id: string;
    title: string | null;
  };
};

export class WorkspaceInviteService {
  constructor(
    private readonly clock: Clock,
    private readonly workspaceInviteRepo: WorkspaceInviteRepo,
    private readonly workspaceRepo: WorkspaceRepo,
    private readonly workspaceMemberRepo: WorkspaceMemberRepo
  ) {}

  async acceptInvite(
    token: string,
    userId: string,
    profile?: {
      tgFirstName?: string | null;
      tgLastName?: string | null;
      tgUsername?: string | null;
    }
  ): Promise<AcceptInviteResult> {
    const now = this.clock.now();
    const invite = await this.workspaceInviteRepo.findValidByToken(token, now);
    if (!invite) {
      throw new WorkspaceInviteError("Invite is invalid or expired");
    }

    const workspace = await this.workspaceRepo.findById(invite.workspaceId);
    if (!workspace) {
      throw new WorkspaceInviteError("Workspace not found");
    }

    const existingMembership = await this.workspaceMemberRepo.findMember(invite.workspaceId, userId);
    await this.workspaceMemberRepo.upsertMember(
      invite.workspaceId,
      userId,
      existingMembership?.role ?? "MEMBER",
      now,
      profile
    );

    return {
      workspace: {
        id: workspace.id,
        title: workspace.title
      }
    };
  }
}
