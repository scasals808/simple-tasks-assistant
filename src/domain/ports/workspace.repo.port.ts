export type Workspace = {
  id: string;
  chatId: string;
  title: string | null;
  assignerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface WorkspaceRepo {
  ensureByChatId(chatId: string, title?: string): Promise<Workspace>;
  findById(id: string): Promise<Workspace | null>;
}
