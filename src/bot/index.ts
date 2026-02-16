import { Markup, Telegraf } from "telegraf";

import type { TaskService } from "../domain/tasks/task.service.js";

function getTelegramError(error: unknown): { code?: number; description?: string } {
  const err = error as { response?: { error_code?: number; description?: string } };
  return {
    code: err.response?.error_code,
    description: err.response?.description
  };
}

function logCallbackStep(
  ctx: {
    update?: { update_id?: number };
    from?: { id?: number };
  },
  step: "answerCbQuery_url" | "answerCbQuery_ack" | "dm_fallback" | "deleteMessage",
  chatId: number,
  messageId: number,
  error?: unknown
): void {
  const info = error ? getTelegramError(error) : undefined;
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    user_id: ctx.from?.id,
    update_id: ctx.update?.update_id,
    handler: "create_task",
    step,
    telegram_error_code: info?.code ?? null,
    telegram_description: info?.description ?? (error ? String(error) : null)
  };
  if (error) {
    console.warn("[bot.create_task.callback_step_failed]", payload);
    return;
  }
  console.log("[bot.create_task.callback_step_ok]", payload);
}

export function buildSourceLink(
  chatId: number,
  chatUsername: string | undefined,
  messageId: number
): string | null {
  if (chatUsername) {
    return `https://t.me/${chatUsername}/${messageId}`;
  }

  const raw = String(chatId);
  if (raw.startsWith("-100")) {
    return `https://t.me/c/${raw.slice(4)}/${messageId}`;
  }

  return null;
}

export function extractStartPayload(text: string | undefined): string | null {
  if (!text) return null;
  const parts = text.trim().split(/\s+/);
  return parts.length > 1 ? parts[1] : null;
}

export function createBot(
  token: string,
  taskService: TaskService,
  botUsername: string
): Telegraf {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    const payload = extractStartPayload((ctx.message as { text?: string }).text);
    if (payload) {
      const result = await taskService.finalizeDraft(payload, String(ctx.from.id));
      if (!result) {
        await ctx.reply("Черновик не найден");
        return;
      }

      if (result.status === "ALREADY_EXISTS") {
        await ctx.reply(`Задача уже существует (id: ${result.task.id})`);
        return;
      }

      await ctx.reply(`Задача создана (id: ${result.task.id})`);
      return;
    }

    await ctx.reply(
      "Привет! Я помогу быстро создавать задачи из сообщений.",
      Markup.keyboard([["📌 Мои задачи", "➕ Создать задачу"], ["ℹ️ Помощь"]]).resize()
    );
  });

  bot.hears(["📌 Мои задачи", "➕ Создать задачу", "ℹ️ Помощь"], async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    await ctx.reply("Not implemented yet");
  });

  bot.command("task", async (ctx) => {
    const message = ctx.message as {
      from?: { id?: number };
      chat?: { id?: number; username?: string; type?: string };
      reply_to_message?: {
        message_id?: number;
        text?: string;
        caption?: string;
        from?: { id?: number };
      };
    };

    if (!message.reply_to_message) {
      await ctx.reply("Reply to a message and send /task");
      return;
    }

    if (!message.chat || !message.from || message.chat.type === "private") {
      return;
    }

    if (message.reply_to_message.from?.id !== message.from.id) {
      return;
    }

    const tokenForTask = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await taskService.createDraft({
      token: tokenForTask,
      sourceChatId: String(message.chat.id),
      sourceMessageId: String(message.reply_to_message.message_id),
      sourceText: message.reply_to_message.text ?? message.reply_to_message.caption ?? "",
      sourceLink: buildSourceLink(
        message.chat.id ?? 0,
        message.chat.username,
        message.reply_to_message.message_id ?? 0
      ),
      creatorUserId: String(message.from.id)
    });

    await ctx.reply(
      "Create task?",
      Markup.inlineKeyboard([
        Markup.button.callback("➕ Create task", `create_task:${tokenForTask}`)
      ])
    );
  });

  bot.action(/^create_task:(.+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    const deepLink = `https://t.me/${botUsername}?start=${tokenForTask}`;

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChat =
      callbackMessage && "chat" in callbackMessage ? callbackMessage.chat : undefined;
    const callbackMessageId =
      callbackMessage && "message_id" in callbackMessage ? callbackMessage.message_id : undefined;
    const callbackChatId = callbackChat?.id ?? 0;
    const callbackMsgId = callbackMessageId ?? 0;

    try {
      await ctx.answerCbQuery(undefined, { url: deepLink });
      logCallbackStep(ctx, "answerCbQuery_url", callbackChatId, callbackMsgId);
    } catch (error: unknown) {
      logCallbackStep(ctx, "answerCbQuery_url", callbackChatId, callbackMsgId, error);
      try {
        await ctx.answerCbQuery("Opening bot...");
        logCallbackStep(ctx, "answerCbQuery_ack", callbackChatId, callbackMsgId);
      } catch (ackError: unknown) {
        logCallbackStep(ctx, "answerCbQuery_ack", callbackChatId, callbackMsgId, ackError);
      }
      try {
        await ctx.telegram.sendMessage(ctx.from.id, `Open bot: ${deepLink}`);
        logCallbackStep(ctx, "dm_fallback", callbackChatId, callbackMsgId);
      } catch (dmError: unknown) {
        logCallbackStep(ctx, "dm_fallback", callbackChatId, callbackMsgId, dmError);
      }
    }

    if (
      callbackChat &&
      callbackMessageId &&
      (callbackChat.type === "group" || callbackChat.type === "supergroup")
    ) {
      try {
        await ctx.deleteMessage();
        logCallbackStep(ctx, "deleteMessage", callbackChat.id, callbackMessageId);
      } catch (deleteError: unknown) {
        logCallbackStep(ctx, "deleteMessage", callbackChat.id, callbackMessageId, deleteError);
      }
    }
  });

  return bot;
}
