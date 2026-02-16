export type WorkspaceMemberRole = "ASSIGNER" | "EXECUTOR";

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
}
