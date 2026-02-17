import type {
  CreateTaskActionInput,
  TaskAction,
  TaskActionRepo
} from "../../domain/ports/task-action.repo.port.js";
import { prisma } from "./prisma.js";

function mapTaskAction(row: {
  id: string;
  taskId: string;
  actorUserId: string;
  type: string;
  nonce: string;
  createdAt: Date;
}): TaskAction {
  return {
    id: row.id,
    taskId: row.taskId,
    actorUserId: row.actorUserId,
    type: row.type as 'SUBMIT_FOR_REVIEW',
    nonce: row.nonce,
    createdAt: row.createdAt
  };
}

export class PrismaTaskActionRepo implements TaskActionRepo {
  async create(input: CreateTaskActionInput): Promise<TaskAction> {
    const row = await prisma.taskAction.create({
      data: {
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        type: input.type,
        nonce: input.nonce
      }
    });
    return mapTaskAction(row);
  }

  async findByNonce(nonce: string): Promise<TaskAction | null> {
    const row = await prisma.taskAction.findUnique({
      where: { nonce }
    });
    return row ? mapTaskAction(row) : null;
  }
}