export interface TaskAction {
  id: string;
  taskId: string;
  actorUserId: string;
  type: "SUBMIT_FOR_REVIEW" | "SELF_CLOSE" | "ACCEPT_REVIEW" | "RETURN_TO_WORK";
  nonce: string;
  createdAt: Date;
}

export interface CreateTaskActionInput {
  taskId: string;
  actorUserId: string;
  type: "SUBMIT_FOR_REVIEW" | "SELF_CLOSE" | "ACCEPT_REVIEW" | "RETURN_TO_WORK";
  nonce: string;
}

export interface TaskActionRepo {
  create(input: CreateTaskActionInput): Promise<TaskAction>;
  findByNonce(nonce: string): Promise<TaskAction | null>;
}