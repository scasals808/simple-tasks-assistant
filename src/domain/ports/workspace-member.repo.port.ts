export type WorkspaceMemberRole = "OWNER" | "MEMBER";

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceMemberRole;
  joinedAt: Date;
  lastSeenAt: Date;
};

export interface WorkspaceMemberRepo {
  upsertMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceMemberRole,
    lastSeenAt: Date
  ): Promise<WorkspaceMember>;
  findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;
  listByWorkspace(workspaceId: string): Promise<WorkspaceMember[]>;
  findLatestWorkspaceIdByUser(userId: string): Promise<string | null>;
}
