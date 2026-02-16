import type { Context } from "telegraf";

export async function sendEphemeral(
  ctx: Context,
  text: string,
  ttlMs = 2500
): Promise<void> {
  const chat = (ctx as Context & { chat?: { id?: number; type?: string } }).chat;
  if (!chat || (chat.type !== "group" && chat.type !== "supergroup")) {
    return;
  }

  const sent = await ctx.reply(text);
  const chatId = sent.chat.id;
  const messageId = sent.message_id;

  setTimeout(() => {
    void ctx.telegram.deleteMessage(chatId, messageId).catch((error: unknown) => {
      const err = error as { response?: { error_code?: number; description?: string } };
      console.warn("[ephemeral-delete-failed]", {
        chatId,
        messageId,
        code: err.response?.error_code,
        message: err.response?.description ?? String(error)
      });
    });
  }, ttlMs);
}
