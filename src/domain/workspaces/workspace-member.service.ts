import type { Clock } from "../ports/clock.port.js";
import type { WorkspaceMember, WorkspaceMemberRepo } from "../ports/workspace-member.repo.port.js";

export class WorkspaceMemberService {
  constructor(
    private readonly clock: Clock,
    private readonly workspaceMemberRepo: WorkspaceMemberRepo
  ) {}

  async upsertMemberMembership(
    workspaceId: string,
    userId: string,
    role: "OWNER" | "MEMBER"
  ): Promise<WorkspaceMember> {
    return this.workspaceMemberRepo.upsertMember(
      workspaceId,
      userId,
      role,
      this.clock.now()
    );
  }

  async upsertOwnerMembership(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    return this.upsertMemberMembership(workspaceId, userId, "OWNER");
  }

  async upsertMemberRole(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    return this.upsertMemberMembership(workspaceId, userId, "MEMBER");
  }

  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.workspaceMemberRepo.listByWorkspace(workspaceId);
  }

  async findLatestWorkspaceIdForUser(userId: string): Promise<string | null> {
    return this.workspaceMemberRepo.findLatestWorkspaceIdByUser(userId);
  }
}
