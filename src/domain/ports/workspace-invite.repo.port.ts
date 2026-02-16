export type WorkspaceInvite = {
  id: string;
  token: string;
  workspaceId: string;
  expiresAt: Date | null;
  createdAt: Date;
};

export interface WorkspaceInviteRepo {
  findValidByToken(token: string, now: Date): Promise<WorkspaceInvite | null>;
  createInvite(workspaceId: string, token: string, expiresAt: Date | null): Promise<WorkspaceInvite>;
}
