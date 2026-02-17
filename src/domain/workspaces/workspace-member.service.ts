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
    role: "OWNER" | "MEMBER",
    profile?: {
      tgFirstName?: string | null;
      tgLastName?: string | null;
      tgUsername?: string | null;
    }
  ): Promise<WorkspaceMember> {
    return this.workspaceMemberRepo.upsertMember(
      workspaceId,
      userId,
      role,
      this.clock.now(),
      profile
    );
  }

  async upsertOwnerMembership(
    workspaceId: string,
    userId: string,
    profile?: {
      tgFirstName?: string | null;
      tgLastName?: string | null;
      tgUsername?: string | null;
    }
  ): Promise<WorkspaceMember> {
    return this.upsertMemberMembership(workspaceId, userId, "OWNER", profile);
  }

  async upsertMemberRole(
    workspaceId: string,
    userId: string,
    profile?: {
      tgFirstName?: string | null;
      tgLastName?: string | null;
      tgUsername?: string | null;
    }
  ): Promise<WorkspaceMember> {
    return this.upsertMemberMembership(workspaceId, userId, "MEMBER", profile);
  }

  async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.workspaceMemberRepo.listByWorkspace(workspaceId);
  }

  async findLatestWorkspaceIdForUser(userId: string): Promise<string | null> {
    return this.workspaceMemberRepo.findLatestWorkspaceIdByUser(userId);
  }

  async touchLatestMembershipProfile(
    userId: string,
    profile: {
      tgFirstName?: string | null;
      tgLastName?: string | null;
      tgUsername?: string | null;
    }
  ): Promise<void> {
    const workspaceId = await this.workspaceMemberRepo.findLatestWorkspaceIdByUser(userId);
    if (!workspaceId) {
      return;
    }
    const existing = await this.workspaceMemberRepo.findMember(workspaceId, userId);
    if (!existing) {
      return;
    }
    await this.workspaceMemberRepo.upsertMember(workspaceId, userId, existing.role, this.clock.now(), profile);
  }
}
