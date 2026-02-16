import { Markup, Scenes, Telegraf, session } from "telegraf";

import type { TaskService } from "../domain/tasks/task.service.js";
import type { PendingDeletionRepoPrisma } from "../infra/db/pendingDeletion.repo.prisma.js";
import { createTaskWizardScene } from "./scenes/createTask.scene.js";
import type { BotContext } from "./scenes/createTask.scene.js";
import { processDueDeletions, sendEphemeral } from "./utils/ephemeral.js";

type PendingTaskSource = {
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
};

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

    const me = await bot.telegram.getMe();
    if (!me.username) {
      await sendEphemeral(ctx, pendingDeletionRepo, "Не удалось открыть чат");
      return;
    }

    const startLink = `https://t.me/${me.username}?start=ct_${tokenForTask}`;
    if (message.chat.type === "group" || message.chat.type === "supergroup") {
      await sendEphemeral(ctx, pendingDeletionRepo, `Откройте личный чат: ${startLink}`);
      return;
    }

    await ctx.reply(
      "Откройте личный чат и продолжите создание задачи",
      Markup.inlineKeyboard([Markup.button.url("Перейти в личный чат", startLink)])
    );
  });

  return bot;
}
