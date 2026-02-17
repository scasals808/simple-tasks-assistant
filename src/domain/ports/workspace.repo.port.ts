export type Workspace = {
  id: string;
  chatId: string;
  title: string | null;
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface WorkspaceRepo {
  ensureByChatId(chatId: string, title?: string): Promise<Workspace>;
  findByChatId(chatId: string): Promise<Workspace | null>;
  findById(id: string): Promise<Workspace | null>;
  createManual(chatId: string, title?: string): Promise<Workspace>;
  findLatest(): Promise<Workspace | null>;
  updateOwner(workspaceId: string, ownerUserId: string | null): Promise<Workspace>;
}
