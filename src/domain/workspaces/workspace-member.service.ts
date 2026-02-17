import type { Clock } from "../ports/clock.port.js";
import type {
  WorkspaceMember,
  WorkspaceMemberRepo,
  WorkspaceMemberStatus
} from "../ports/workspace-member.repo.port.js";
import { requireActiveMembership } from "./membership-gates.js";

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

  async findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.workspaceMemberRepo.findMember(workspaceId, userId);
  }

  async findActiveMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.workspaceMemberRepo.findActiveMember(workspaceId, userId);
  }

  async requireActiveMembership(workspaceId: string, userId: string): Promise<boolean> {
    return requireActiveMembership(this.workspaceMemberRepo, workspaceId, userId);
  }

  async setMemberStatus(
    workspaceId: string,
    userId: string,
    status: WorkspaceMemberStatus
  ): Promise<WorkspaceMember> {
    const existing = await this.workspaceMemberRepo.findMember(workspaceId, userId);
    if (!existing) {
      throw new Error("Membership not found");
    }
    if (existing.role === "OWNER" && status === "REMOVED") {
      throw new Error("Owner membership cannot be removed");
    }
    return this.workspaceMemberRepo.setMemberStatus(workspaceId, userId, status);
  }

  async removeMember(input: {
    workspaceId: string;
    actorUserId: string;
    memberUserId: string;
  }): Promise<
    | { status: "FORBIDDEN" }
    | { status: "NOT_FOUND" }
    | { status: "CANNOT_REMOVE_OWNER" }
    | { status: "ALREADY_REMOVED" }
    | { status: "REMOVED"; member: WorkspaceMember }
  > {
    const actor = await this.workspaceMemberRepo.findActiveMember(input.workspaceId, input.actorUserId);
    if (!actor || actor.role !== "OWNER") {
      return { status: "FORBIDDEN" };
    }
    const member = await this.workspaceMemberRepo.findMember(input.workspaceId, input.memberUserId);
    if (!member) {
      return { status: "NOT_FOUND" };
    }
    if (member.role === "OWNER") {
      return { status: "CANNOT_REMOVE_OWNER" };
    }
    if (member.status === "REMOVED") {
      return { status: "ALREADY_REMOVED" };
    }
    const removed = await this.workspaceMemberRepo.setMemberStatus(
      input.workspaceId,
      input.memberUserId,
      "REMOVED"
    );
    return { status: "REMOVED", member: removed };
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
