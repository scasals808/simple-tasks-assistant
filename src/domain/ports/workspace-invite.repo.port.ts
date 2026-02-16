export type WorkspaceInvite = {
  id: string;
  token: string;
  workspaceId: string;
  expiresAt: Date | null;
  createdAt: Date;
};

export interface WorkspaceInviteRepo {
  findValidByToken(token: string, now: Date): Promise<WorkspaceInvite | null>;
}
