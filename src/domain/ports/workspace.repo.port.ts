export type WorkspaceStatus = "ACTIVE" | "ARCHIVED";

export type Workspace = {
  id: string;
  chatId: string;
  title: string | null;
  ownerUserId: string | null;
  status: WorkspaceStatus;
  createdAt: Date;
  updatedAt: Date;
};

export interface WorkspaceRepo {
  ensureByChatId(chatId: string, title?: string): Promise<Workspace>;
  findByChatId(chatId: string): Promise<Workspace | null>;
  findById(id: string): Promise<Workspace | null>;
  createManual(chatId: string, title?: string): Promise<Workspace>;
  findLatest(): Promise<Workspace | null>;
  findActiveByOwnerUserId(ownerUserId: string): Promise<Workspace | null>;
  findLatestByOwnerUserId(ownerUserId: string): Promise<Workspace | null>;
  updateOwner(workspaceId: string, ownerUserId: string | null): Promise<Workspace>;
  closeWorkspace(workspaceId: string): Promise<Workspace>;
  relinkChatIdToWorkspace(chatId: string, targetWorkspaceId: string): Promise<Workspace>;
}
