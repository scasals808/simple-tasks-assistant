import { Markup, type Telegraf } from "telegraf";

import type { BotDeps } from "../types.js";
import { buildSourceLink } from "../ui/keyboards.js";
import { renderTaskLine, renderTaskListHeader } from "../ui/messages.js";
import { logDmCreateTask, logStep, logTaskList } from "./logging.js";

export function registerTaskRoutes(bot: Telegraf, deps: BotDeps): void {
  async function handleTaskList(
    ctx: {
      from: { id: number };
      reply(text: string): Promise<unknown>;
    },
    kind: "assigned" | "created"
  ): Promise<void> {
    const userId = String(ctx.from.id);
    const startedAt = Date.now();
    try {
      const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(userId);
      if (!workspaceId) {
        logTaskList({
          handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
          userId,
          workspaceId: null,
          count: 0,
          queryMs: Date.now() - startedAt,
          errorCode: "NOT_IN_WORKSPACE"
        });
        await ctx.reply("Сначала вступите в команду по invite-ссылке.");
        return;
      }

      const result =
        kind === "assigned"
          ? await deps.taskService.listAssignedTasks({ workspaceId, viewerUserId: userId, limit: 20 })
          : await deps.taskService.listCreatedTasks({ workspaceId, viewerUserId: userId, limit: 20 });
      if (result.status === "NOT_IN_WORKSPACE") {
        logTaskList({
          handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
          userId,
          workspaceId,
          count: 0,
          queryMs: Date.now() - startedAt,
          errorCode: "NOT_IN_WORKSPACE"
        });
        await ctx.reply("Сначала вступите в команду по invite-ссылке.");
        return;
      }

      const header = renderTaskListHeader(kind, result.tasks.length);
      if (result.tasks.length === 0) {
        logTaskList({
          handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
          userId,
          workspaceId,
          count: 0,
          queryMs: Date.now() - startedAt
        });
        await ctx.reply(`${header}\nПока пусто.`);
        return;
      }

      const body = result.tasks.map((task) => renderTaskLine(task)).join("\n");
      logTaskList({
        handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
        userId,
        workspaceId,
        count: result.tasks.length,
        queryMs: Date.now() - startedAt
      });
      await ctx.reply(`${header}\n${body}`);
    } catch {
      logTaskList({
        handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
        userId,
        workspaceId: null,
        count: 0,
        queryMs: Date.now() - startedAt,
        errorCode: "LIST_FAILED"
      });
      await ctx.reply("Не удалось загрузить задачи.");
    }
  }

  async function handleDmCreateTask(ctx: {
    chat: { type: string };
    from: { id: number };
    reply(text: string, extra?: unknown): Promise<unknown>;
  }): Promise<void> {
    if (ctx.chat.type !== "private") {
      return;
    }
    const userId = String(ctx.from.id);
    const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(userId);
    if (!workspaceId) {
      logDmCreateTask({
        userId,
        workspaceId: null,
        draftToken: null,
        step: "start",
        errorCode: "NOT_IN_WORKSPACE"
      });
      await ctx.reply("You are not connected to a team. Ask for invite link.");
      return;
    }
    const draft = await deps.taskService.startDmDraft({
      workspaceId,
      creatorUserId: userId
    });
    logDmCreateTask({
      userId,
      workspaceId,
      draftToken: draft.token,
      step: "enter_text"
    });
    await ctx.reply("Send task text in one message.");
  }

  bot.hears(["📥 Мне назначено", "✍️ Я создал", "➕ Новая задача", "ℹ️ Помощь"], async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    const text = (ctx.message as { text?: string }).text ?? "";
    if (text === "📥 Мне назначено") {
      await handleTaskList(
        ctx as unknown as {
          from: { id: number };
          reply(text: string): Promise<unknown>;
        },
        "assigned"
      );
      return;
    }
    if (text === "✍️ Я создал") {
      await handleTaskList(
        ctx as unknown as {
          from: { id: number };
          reply(text: string): Promise<unknown>;
        },
        "created"
      );
      return;
    }
    if (text === "➕ Новая задача") {
      await handleDmCreateTask(
        ctx as unknown as {
          chat: { type: string };
          from: { id: number };
          reply(text: string, extra?: unknown): Promise<unknown>;
        }
      );
      return;
    }
    await ctx.reply("Not implemented yet");
  });

  bot.command("new_task", async (ctx) => {
    await handleDmCreateTask(
      ctx as unknown as {
        chat: { type: string };
        from: { id: number };
        reply(text: string, extra?: unknown): Promise<unknown>;
      }
    );
  });

  bot.command("assigned", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    await handleTaskList(
      ctx as unknown as {
        from: { id: number };
        reply(text: string): Promise<unknown>;
      },
      "assigned"
    );
  });

  bot.command("created", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    await handleTaskList(
      ctx as unknown as {
        from: { id: number };
        reply(text: string): Promise<unknown>;
      },
      "created"
    );
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
    await deps.taskService.createDraft({
      token: tokenForTask,
      workspaceId: (await deps.workspaceService.findWorkspaceByChatId(String(message.chat.id)))?.id ?? null,
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
    const deepLink = `https://t.me/${deps.botUsername}?start=${tokenForTask}`;

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChat =
      callbackMessage && "chat" in callbackMessage ? callbackMessage.chat : undefined;
    const callbackMessageId =
      callbackMessage && "message_id" in callbackMessage ? callbackMessage.message_id : undefined;
    const callbackChatId = callbackChat?.id ?? 0;
    const callbackMsgId = callbackMessageId ?? 0;

    try {
      await ctx.answerCbQuery(undefined, { url: deepLink });
      logStep(ctx, "create_task", tokenForTask, "answerCbQuery_url", callbackChatId, callbackMsgId);
    } catch (error: unknown) {
      logStep(
        ctx,
        "create_task",
        tokenForTask,
        "answerCbQuery_url",
        callbackChatId,
        callbackMsgId,
        error
      );
      try {
        await ctx.answerCbQuery("Opening bot...");
        logStep(
          ctx,
          "create_task",
          tokenForTask,
          "answerCbQuery_ack",
          callbackChatId,
          callbackMsgId
        );
      } catch (ackError: unknown) {
        logStep(
          ctx,
          "create_task",
          tokenForTask,
          "answerCbQuery_ack",
          callbackChatId,
          callbackMsgId,
          ackError
        );
      }
      try {
        await ctx.telegram.sendMessage(ctx.from.id, `Open bot: ${deepLink}`);
        logStep(ctx, "create_task", tokenForTask, "dm_fallback", callbackChatId, callbackMsgId);
      } catch (dmError: unknown) {
        logStep(
          ctx,
          "create_task",
          tokenForTask,
          "dm_fallback",
          callbackChatId,
          callbackMsgId,
          dmError
        );
      }
    }

    if (
      callbackChat &&
      callbackMessageId &&
      (callbackChat.type === "group" || callbackChat.type === "supergroup")
    ) {
      try {
        await ctx.deleteMessage();
        logStep(
          ctx,
          "create_task",
          tokenForTask,
          "deleteMessage",
          callbackChat.id,
          callbackMessageId
        );
      } catch (deleteError: unknown) {
        logStep(
          ctx,
          "create_task",
          tokenForTask,
          "deleteMessage",
          callbackChat.id,
          callbackMessageId,
          deleteError
        );
      }
    }
  });
}
