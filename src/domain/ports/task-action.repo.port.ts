export interface TaskAction {
  id: string;
  taskId: string;
  actorUserId: string;
  type: 'SUBMIT_FOR_REVIEW';
  nonce: string;
  createdAt: Date;
}

export interface CreateTaskActionInput {
  taskId: string;
  actorUserId: string;
  type: 'SUBMIT_FOR_REVIEW';
  nonce: string;
}

export interface TaskActionRepo {
  create(input: CreateTaskActionInput): Promise<TaskAction>;
  findByNonce(nonce: string): Promise<TaskAction | null>;
}