import type { Context } from "telegraf";
import type { PendingDeletionRepoPrisma } from "../../infra/db/pendingDeletion.repo.prisma.js";

let deletionPersistenceDisabled = false;
let missingTableLogged = false;

function isMissingTableError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2021"
  );
}

async function scheduleDeletion(
  pendingDeletionRepo: PendingDeletionRepoPrisma,
  chatId: string,
  messageId: string,
  ttlMs: number
): Promise<void> {
  if (deletionPersistenceDisabled) {
    return;
  }

  try {
    await pendingDeletionRepo.schedule(
      chatId,
      messageId,
      new Date(Date.now() + ttlMs)
    );
  } catch (error: unknown) {
    if (isMissingTableError(error)) {
      deletionPersistenceDisabled = true;
      if (!missingTableLogged) {
        missingTableLogged = true;
        console.warn("[pending-deletion-disabled-missing-table]");
      }
      return;
    }
    console.warn("[pending-deletion-schedule-error]", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

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
  await scheduleDeletion(
    pendingDeletionRepo,
    String(sent.chat.id),
    String(sent.message_id),
    ttlMs
  );
}

export async function scheduleSentMessageDeletion(
  pendingDeletionRepo: PendingDeletionRepoPrisma,
  chatId: string,
  messageId: string,
  ttlMs = 30_000
): Promise<void> {
  await scheduleDeletion(pendingDeletionRepo, chatId, messageId, ttlMs);
}

export async function processDueDeletions(
  ctx: Context,
  pendingDeletionRepo: PendingDeletionRepoPrisma,
  limit = 20
): Promise<void> {
  if (deletionPersistenceDisabled) {
    return;
  }

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
    if (isMissingTableError(error)) {
      deletionPersistenceDisabled = true;
      if (!missingTableLogged) {
        missingTableLogged = true;
        console.warn("[pending-deletion-disabled-missing-table]");
      }
      return;
    }

    console.warn("[pending-deletion-process-error]", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
