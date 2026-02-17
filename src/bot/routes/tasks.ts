import { Markup, type Telegraf } from "telegraf";

import type { BotDeps } from "../types.js";
import { ru } from "../texts/ru.js";
import { buildSourceLink } from "../ui/keyboards.js";
import { renderTaskLine, renderTaskListHeader } from "../ui/messages.js";
import { logDmCreateTask, logGroupTask, logStep, logTaskList } from "./logging.js";

export function registerTaskRoutes(bot: Telegraf, deps: BotDeps): void {
  async function handleTaskList(
    ctx: {
      from: { id: number };
      reply(text: string, extra?: unknown): Promise<unknown>;
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
        await ctx.reply(ru.taskList.joinTeamFirst);
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
        await ctx.reply(ru.taskList.joinTeamFirst);
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
        await ctx.reply(`${header}\n${ru.taskList.empty}`);
        return;
      }

      const body = result.tasks.map((task) => renderTaskLine(task)).join("\n");
      const contextButtons = result.tasks.map((task) => [
        Markup.button.callback(`Show context (${task.id})`, `task_context:${task.id}`)
      ]);
      logTaskList({
        handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
        userId,
        workspaceId,
        count: result.tasks.length,
        queryMs: Date.now() - startedAt
      });
      await ctx.reply(`${header}\n${body}`, Markup.inlineKeyboard(contextButtons));
    } catch {
      logTaskList({
        handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
        userId,
        workspaceId: null,
        count: 0,
        queryMs: Date.now() - startedAt,
        errorCode: "LIST_FAILED"
      });
      await ctx.reply(ru.taskList.loadFailed);
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
      await ctx.reply(ru.dmTask.notInWorkspace);
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
    await ctx.reply(ru.dmTask.enterText);
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
    await ctx.reply(ru.common.notImplemented);
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
      await ctx.reply(ru.groupTask.needReply);
      return;
    }

    if (!message.chat || !message.from || message.chat.type === "private") {
      return;
    }

    const chatId = String(message.chat.id);
    const sourceMessageId = String(message.reply_to_message.message_id);
    const userId = String(message.from.id);
    logGroupTask({
      event: "received",
      chatId,
      messageId: sourceMessageId,
      userId
    });

    try {
      const tokenForTask = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const draftResult = await deps.taskService.createOrReuseGroupDraft({
        token: tokenForTask,
        workspaceId: (await deps.workspaceService.findWorkspaceByChatId(chatId))?.id ?? null,
        sourceChatId: chatId,
        sourceMessageId,
        sourceText: message.reply_to_message.text ?? message.reply_to_message.caption ?? "",
        sourceLink: buildSourceLink(
          message.chat.id ?? 0,
          message.chat.username,
          message.reply_to_message.message_id ?? 0
        ),
        creatorUserId: userId
      });

      logGroupTask({
        event: draftResult.reused ? "draft_found" : "draft_created",
        chatId,
        messageId: sourceMessageId,
        userId,
        draftId: draftResult.draft.id,
        token: draftResult.draft.token
      });

      await ctx.reply(
        ru.groupTask.prompt,
        Markup.inlineKeyboard([
          Markup.button.callback(ru.groupTask.buttonCreate, `create_task:${draftResult.draft.token}`)
        ])
      );
    } catch {
      logGroupTask({
        event: "error",
        chatId,
        messageId: sourceMessageId,
        userId,
        errorCode: "DRAFT_CREATE_FAILED"
      });
      await ctx.reply(ru.groupTask.createFailed);
    }
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
        await ctx.answerCbQuery();
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

  bot.action(/^task_context:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await ctx.answerCbQuery();
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.common.taskNotFound);
      return;
    }

    const sourceChatIdNum = Number(task.sourceChatId);
    const sourceMessageIdNum = Number(task.sourceMessageId);
    const targetChatId =
      "chat" in ctx && ctx.chat && "id" in ctx.chat ? ctx.chat.id : ctx.from.id;
    if (Number.isFinite(sourceChatIdNum) && Number.isFinite(sourceMessageIdNum)) {
      try {
        await ctx.telegram.copyMessage(targetChatId, sourceChatIdNum, sourceMessageIdNum);
        return;
      } catch (error: unknown) {
        const err = error as { response?: { error_code?: number } };
        console.warn("[bot.task_context.copy_failed]", {
          chat_id: task.sourceChatId,
          message_id: task.sourceMessageId,
          error_code: err.response?.error_code ?? null
        });
      }
    }

    const fallback = task.sourceText.length > 500 ? `${task.sourceText.slice(0, 500)}...` : task.sourceText;
    await ctx.reply(fallback || "-");
  });
}
