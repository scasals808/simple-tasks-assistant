export type WorkspaceMemberRole = "OWNER" | "MEMBER";
export type WorkspaceMemberStatus = "ACTIVE" | "REMOVED";

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  tgFirstName: string | null;
  tgLastName: string | null;
  tgUsername: string | null;
  joinedAt: Date;
  lastSeenAt: Date;
};

export interface WorkspaceMemberRepo {
  upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
    lastSeenAt: Date,
    profile?: {
      tgFirstName?: string | null;
      tgLastName?: string | null;
      tgUsername?: string | null;
    }
  ): Promise<WorkspaceMember>;
  findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  findActiveMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  listByWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
  findLatestWorkspaceIdByUser(userId: string): Promise<string | null>;
  setMemberStatus(
    workspaceId: string,
    userId: string,
    status: WorkspaceMemberStatus
  ): Promise<WorkspaceMember>;
}
