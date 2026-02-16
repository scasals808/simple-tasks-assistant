export type WorkspaceResetCounts = {
  workspaceMembers: number;
  workspaceInvites: number;
  workspaces: number;
};

export interface WorkspaceResetRepo {
  resetAllWorkspaceData(): Promise<WorkspaceResetCounts>;
}
