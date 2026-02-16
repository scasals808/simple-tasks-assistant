import { Markup, Scenes, Telegraf, session } from "telegraf";

import type { TaskService } from "../domain/tasks/task.service.js";
import type { PendingDeletionRepoPrisma } from "../infra/db/pendingDeletion.repo.prisma.js";
import { createTaskWizardScene } from "./scenes/createTask.scene.js";
import type { BotContext } from "./scenes/createTask.scene.js";
import {
  processDueDeletions,
  scheduleSentMessageDeletion,
  sendEphemeral
} from "./utils/ephemeral.js";

type PendingTaskSource = {
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
};

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

async function deleteTechnicalMessage(
  ctx: BotContext,
  chatId: number,
  messageId: number
): Promise<void> {
  try {
    await ctx.telegram.deleteMessage(chatId, messageId);
    console.log(`[ui] delete_ok chatId=${chatId} messageId=${messageId}`);
  } catch (error: unknown) {
    const info = getTelegramError(error);
    console.warn(
      `[ui] delete_failed chatId=${chatId} messageId=${messageId} code=${info.code ?? "unknown"} description=${info.description ?? String(error)}`
    );
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
  taskService: TaskService,
  pendingDeletionRepo: PendingDeletionRepoPrisma
): Telegraf<BotContext> {
  const bot = new Telegraf<BotContext>(token);
  const pendingByToken = new Map<string, PendingTaskSource>();

  const createTaskScene = createTaskWizardScene(taskService, pendingByToken);
  const stage = new Scenes.Stage<BotContext>([createTaskScene]);

  const sendDmForTask = async (userId: string, tokenForTask: string): Promise<boolean> => {
    try {
      await bot.telegram.sendMessage(
        Number(userId),
        `Продолжим в личке 👇\nОтправьте /start ct_${tokenForTask}`
      );
      console.log(`[ui] dm_send_ok userId=${userId}`);
      return true;
    } catch (error: unknown) {
      const info = getTelegramError(error);
      console.warn(
        `[ui] dm_send_failed userId=${userId} code=${info.code ?? "unknown"} description=${info.description ?? String(error)}`
      );
      return false;
    }
  };

  bot.use(session());
  bot.use(async (ctx, next) => {
    await processDueDeletions(ctx, pendingDeletionRepo);
    await next();
  });
  bot.use(stage.middleware());

  bot.start(async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    const payload = extractStartPayload((ctx.message as { text?: string }).text);
    if (payload?.startsWith("ct_")) {
      const tokenFromPayload = payload.replace("ct_", "");
      if (pendingByToken.has(tokenFromPayload)) {
        await ctx.scene.enter("create-task", { token: tokenFromPayload });
        return;
      }
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
      await sendEphemeral(ctx, pendingDeletionRepo, "Reply to a message and send /task");
      return;
    }

    if (!message.chat || !message.from || message.chat.type === "private") {
      return;
    }

    if (message.reply_to_message.from?.id !== message.from.id) {
      return;
    }

    const tokenForTask = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    pendingByToken.set(tokenForTask, {
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

    const sent = await ctx.reply(
      "Создать задачу из этого сообщения?",
      Markup.inlineKeyboard([
        Markup.button.callback("➕ Создать задачу", `create_task:${tokenForTask}`)
      ])
    );
    console.log(
      `[ui] group_message_sent chatId=${sent.chat.id} messageId=${sent.message_id}`
    );
    await scheduleSentMessageDeletion(
      pendingDeletionRepo,
      String(sent.chat.id),
      String(sent.message_id),
      30_000
    );
  });

  bot.action(/^create_task:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChat =
      callbackMessage && "chat" in callbackMessage ? callbackMessage.chat : undefined;
    const callbackMessageId =
      callbackMessage && "message_id" in callbackMessage ? callbackMessage.message_id : undefined;
    const callbackUserId = ctx.from?.id;
    console.log(
      `[ui] create_clicked chatId=${callbackChat?.id ?? "unknown"} messageId=${callbackMessageId ?? "unknown"} userId=${callbackUserId ?? "unknown"}`
    );

    if (
      callbackChat &&
      callbackMessageId &&
      (callbackChat.type === "group" || callbackChat.type === "supergroup")
    ) {
      try {
        await deleteTechnicalMessage(ctx, callbackChat.id, callbackMessageId);
      } catch {
        // never throw from UI delete path
      }
    }

    const tokenForTask = ctx.match[1];
    const pending = pendingByToken.get(tokenForTask);

    if (!pending || !ctx.from || pending.creatorUserId !== String(ctx.from.id)) {
      await ctx.reply("Недоступно");
      return;
    }

    const me = await bot.telegram.getMe();
    const botUsername = getEnv("BOT_USERNAME") ?? me.username;
    if (!botUsername) {
      await ctx.reply("Ошибка");
      return;
    }

    const dmOk = await sendDmForTask(pending.creatorUserId, tokenForTask);
    if (dmOk) {
      return;
    }

    await ctx.reply(
      "Продолжим в личке 👇",
      Markup.inlineKeyboard([
        [Markup.button.url("👤 Перейти в бота", `https://t.me/${botUsername}?start=task`)],
        [Markup.button.callback("✅ Я открыл бота", `create_task_opened:${tokenForTask}`)]
      ])
    );
  });

  bot.action(/^create_task_opened:(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();

    const tokenForTask = ctx.match[1];
    const pending = pendingByToken.get(tokenForTask);
    if (!pending || !ctx.from || pending.creatorUserId !== String(ctx.from.id)) {
      await ctx.reply("Недоступно");
      return;
    }

    const dmOk = await sendDmForTask(pending.creatorUserId, tokenForTask);
    if (dmOk) {
      const callbackMessage =
        "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
      const callbackChat =
        callbackMessage && "chat" in callbackMessage ? callbackMessage.chat : undefined;
      const callbackMessageId =
        callbackMessage && "message_id" in callbackMessage
          ? callbackMessage.message_id
          : undefined;
      if (
        callbackChat &&
        callbackMessageId &&
        (callbackChat.type === "group" || callbackChat.type === "supergroup")
      ) {
        await deleteTechnicalMessage(ctx, callbackChat.id, callbackMessageId);
      }
      return;
    }

    const me = await bot.telegram.getMe();
    const botUsername = getEnv("BOT_USERNAME") ?? me.username ?? "";
    await ctx.editMessageText("Я не могу написать в личку. Нажмите Start в боте и вернитесь сюда.", {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.url("👤 Перейти в бота", `https://t.me/${botUsername}?start=task`)],
        [Markup.button.callback("✅ Я открыл бота", `create_task_opened:${tokenForTask}`)]
      ]).reply_markup
    });
  });

  return bot;
}
