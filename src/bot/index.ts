import { Markup, Telegraf } from "telegraf";

import type { TaskService } from "../domain/tasks/task.service.js";

function getEnv(name: string): string | undefined {
  return (
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.[name] ?? undefined
  );
}

function getTelegramError(error: unknown): { code?: number; description?: string } {
  const err = error as { response?: { error_code?: number; description?: string } };
  return {
    code: err.response?.error_code,
    description: err.response?.description
  };
}

function logDeleteFailure(
  ctx: {
    update?: { update_id?: number };
    from?: { id?: number };
  },
  chatId: number,
  messageId: number,
  error: unknown
): void {
  const info = getTelegramError(error);
  console.warn("[bot.delete_message_failed]", {
    chat_id: chatId,
    message_id: messageId,
    user_id: ctx.from?.id,
    update_id: ctx.update?.update_id,
    handler: "create_task",
    telegram_error_code: info.code ?? null,
    telegram_description: info.description ?? String(error)
  });
}

async function deleteTechnicalMessage(
  ctx: {
    telegram: { deleteMessage(chatId: number, messageId: number): Promise<unknown> };
    update?: { update_id?: number };
    from?: { id?: number };
  },
  chatId: number,
  messageId: number
): Promise<void> {
  try {
    await ctx.telegram.deleteMessage(chatId, messageId);
  } catch (error: unknown) {
    logDeleteFailure(ctx, chatId, messageId, error);
  }
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
  taskService: TaskService
): Telegraf {
  const bot = new Telegraf(token);
  let botUsername: string | null = getEnv("BOT_USERNAME") ?? null;

  const getBotUsername = async (): Promise<string | null> => {
    if (botUsername) {
      return botUsername;
    }
    const me = await bot.telegram.getMe();
    botUsername = me.username ?? null;
    return botUsername;
  };

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
        await ctx.reply("Задача уже существует");
        return;
      }

      await ctx.reply("Задача создана");
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
    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChat =
      callbackMessage && "chat" in callbackMessage ? callbackMessage.chat : undefined;
    const callbackMessageId =
      callbackMessage && "message_id" in callbackMessage ? callbackMessage.message_id : undefined;
    if (
      callbackChat &&
      callbackMessageId &&
      (callbackChat.type === "group" || callbackChat.type === "supergroup")
    ) {
      await deleteTechnicalMessage(ctx, callbackChat.id, callbackMessageId);
    }

    const tokenForTask = ctx.match[1];
    const username = await getBotUsername();
    if (!username) {
      await ctx.answerCbQuery("Ошибка");
      return;
    }

    await ctx.answerCbQuery(undefined, {
      url: `https://t.me/${username}?start=${tokenForTask}`
    });
  });

  return bot;
}
