import { prisma } from "./prisma.js";

export type PendingDeletionRecord = {
  id: string;
  chatId: string;
  messageId: string;
  deleteAfterAt: Date;
  status: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class PendingDeletionRepoPrisma {
  async schedule(
    chatId: string,
    messageId: string,
    deleteAfterAt: Date
  ): Promise<PendingDeletionRecord> {
    return prisma.pendingDeletion.create({
      data: {
        chatId,
        messageId,
        deleteAfterAt
      }
    });
  }

  async findDue(now: Date, limit: number): Promise<PendingDeletionRecord[]> {
    return prisma.pendingDeletion.findMany({
      where: {
        status: "PENDING",
        deleteAfterAt: {
          lte: now
        }
      },
      orderBy: {
        deleteAfterAt: "asc"
      },
      take: limit
    });
  }

  async markDone(id: string): Promise<void> {
    await prisma.pendingDeletion.update({
      where: { id },
      data: {
        status: "DONE",
        attempts: {
          increment: 1
        },
        lastError: null
      }
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await prisma.pendingDeletion.update({
      where: { id },
      data: {
        status: "FAILED",
        attempts: {
          increment: 1
        },
        lastError: error
      }
    });
  }
}
