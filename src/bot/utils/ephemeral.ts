import type { Context } from "telegraf";
import type { PendingDeletionRepoPrisma } from "../../infra/db/pendingDeletion.repo.prisma.js";

export async function sendEphemeral(
  ctx: Context,
  pendingDeletionRepo: PendingDeletionRepoPrisma,
  text: string,
  ttlMs = 30_000
): Promise<void> {
  const chat = (ctx as Context & { chat?: { id?: number; type?: string } }).chat;
  if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) {
    return;
  }

  const sent = await ctx.reply(text);
  const deleteAfterAt = new Date(Date.now() + ttlMs);

  await pendingDeletionRepo.schedule(
    String(sent.chat.id),
    String(sent.message_id),
    deleteAfterAt
  );
}

export async function processDueDeletions(
  ctx: Context,
  pendingDeletionRepo: PendingDeletionRepoPrisma,
  limit = 20
): Promise<void> {
  try {
    const due = await pendingDeletionRepo.findDue(new Date(), limit);
    for (const item of due) {
      try {
        await ctx.telegram.deleteMessage(Number(item.chatId), Number(item.messageId));
        await pendingDeletionRepo.markDone(item.id);
      } catch (error: unknown) {
        const err = error as { response?: { error_code?: number; description?: string } };
        const errorMessage = err.response?.description ?? String(error);
        console.warn("[pending-deletion-failed]", {
          chatId: item.chatId,
          messageId: item.messageId,
          code: err.response?.error_code,
          message: errorMessage
        });
        await pendingDeletionRepo.markFailed(item.id, errorMessage);
      }
    }
  } catch (error: unknown) {
    console.warn("[pending-deletion-process-error]", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
