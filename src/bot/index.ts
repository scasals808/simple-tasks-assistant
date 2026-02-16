import { Markup, Telegraf } from "telegraf";

import type { TaskPriority } from "../domain/tasks/task.types.js";
import type { TaskService } from "../domain/tasks/task.service.js";
import type { WorkspaceInviteService } from "../domain/workspaces/workspace-invite.service.js";
import type { WorkspaceAdminService } from "../domain/workspaces/workspace-admin.service.js";
import { isAdmin } from "../config/env.js";
import { handleStartJoin } from "./start/handlers/start.join.js";
import { handleStartPlain } from "./start/handlers/start.plain.js";
import { handleStartTask } from "./start/handlers/start.task.js";
import {
  extractStartPayload,
  parseStartPayload,
  selectStartRoute
} from "./start/start.router.js";

const ASSIGNEES = [
  { id: "ivan", label: "Ivan" },
  { id: "maria", label: "Maria" },
  { id: "sergey", label: "Sergey" }
] as const;

function getTelegramError(error: unknown): { code?: number; description?: string } {
  const err = error as { response?: { error_code?: number; description?: string } };
  return {
    code: err.response?.error_code,
    description: err.response?.description
  };
}

function tokenShort(token: string): string {
  return token.slice(0, 8);
}

function logStep(
  ctx: {
    update?: { update_id?: number };
    from?: { id?: number };
  },
  handler: string,
  token: string,
  step: string,
  chatId: number,
  messageId: number,
  error?: unknown
): void {
  const info = error ? getTelegramError(error) : undefined;
  const payload = {
    token: tokenShort(token),
    chat_id: chatId,
    message_id: messageId,
    user_id: ctx.from?.id,
    update_id: ctx.update?.update_id,
    handler,
    step,
    telegram_error_code: info?.code ?? null,
    telegram_description: info?.description ?? (error ? String(error) : null)
  };
  if (error) {
    console.warn("[bot.handler_step_failed]", payload);
    return;
  }
  console.log("[bot.handler_step_ok]", payload);
}

function assigneeKeyboard(token: string) {
  return Markup.inlineKeyboard(
    ASSIGNEES.map((item) => [Markup.button.callback(item.label, `draft_assignee:${token}:${item.id}`)])
  );
}

function priorityKeyboard(token: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("P1", `draft_priority:${token}:P1`),
      Markup.button.callback("P2", `draft_priority:${token}:P2`),
      Markup.button.callback("P3", `draft_priority:${token}:P3`)
    ]
  ]);
}

function deadlineKeyboard(token: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Today", `draft_deadline:${token}:today`)],
    [Markup.button.callback("Tomorrow", `draft_deadline:${token}:tomorrow`)],
    [Markup.button.callback("No deadline", `draft_deadline:${token}:none`)],
    [Markup.button.callback("Enter date (YYYY-MM-DD)", `draft_deadline:${token}:manual`)]
  ]);
}

function confirmKeyboard(token: string) {
  return Markup.inlineKeyboard([[Markup.button.callback("Create", `draft_confirm:${token}`)]]);
}

function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Create team", "admin_create_team")],
    [Markup.button.callback("Generate invite link", "admin_generate_invite")],
    [Markup.button.callback("Set assigner", "admin_set_assigner")]
  ]);
}

function logAdminAction(input: {
  handler: string;
  adminUserId?: number;
  workspaceId?: string | null;
  targetUserId?: string | null;
  result: "OK" | "ERROR";
  errorCode?: string | null;
}): void {
  const payload = {
    handler: input.handler,
    admin_user_id: input.adminUserId ?? null,
    workspaceId: input.workspaceId ?? null,
    target_userId: input.targetUserId ?? null,
    result: input.result,
    error_code: input.errorCode ?? null
  };
  if (input.result === "ERROR") {
    console.warn("[bot.admin_action]", payload);
    return;
  }
  console.log("[bot.admin_action]", payload);
}

function logAdminReset(input: {
  adminUserId?: number;
  chatId?: number;
  enabled: boolean;
  confirmed: boolean;
  deletedCounts?: {
    workspaceMembers: number;
    workspaceInvites: number;
    workspaces: number;
  } | null;
  errorCode?: string | null;
  errorDescription?: string | null;
}): void {
  const payload = {
    handler: "admin_reset",
    admin_user_id: input.adminUserId ?? null,
    chat_id: input.chatId ?? null,
    enabled: input.enabled,
    confirmed: input.confirmed,
    deleted_counts: input.deletedCounts ?? null,
    error_code: input.errorCode ?? null,
    description: input.errorDescription ?? null
  };
  if (input.errorCode) {
    console.warn("[bot.admin_reset]", payload);
    return;
  }
  console.log("[bot.admin_reset]", payload);
}

async function updateOrReply(
  ctx: {
    editMessageText(text: string, extra?: { reply_markup?: unknown }): Promise<unknown>;
    reply(text: string, extra?: unknown): Promise<unknown>;
  },
  text: string,
  replyMarkup: unknown
): Promise<void> {
  try {
    await ctx.editMessageText(text, { reply_markup: replyMarkup });
  } catch {
    await ctx.reply(text, { reply_markup: replyMarkup });
  }
}

function isTaskPriority(value: string): value is TaskPriority {
  return value === "P1" || value === "P2" || value === "P3";
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

export { extractStartPayload, parseStartPayload } from "./start/start.router.js";

export function createBot(
  token: string,
  taskService: TaskService,
  botUsername: string,
  workspaceInviteService: WorkspaceInviteService,
  workspaceAdminService: WorkspaceAdminService,
  adminUserIds: string[],
  allowAdminReset: boolean
): Telegraf {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    const payload = extractStartPayload((ctx.message as { text?: string }).text);
    const parsed = parseStartPayload(payload);
    const route = selectStartRoute(parsed);
    if (route === "join" && parsed.type === "join") {
      await handleStartJoin(ctx, workspaceInviteService, parsed.token);
      return;
    }
    if (route === "task" && parsed.type === "task") {
      await handleStartTask(ctx, taskService, parsed.token, assigneeKeyboard);
      return;
    }
    await handleStartPlain(
      ctx,
      Markup.keyboard([["📌 Мои задачи", "➕ Создать задачу"], ["ℹ️ Помощь"], ["Admin"]]).resize()
    );
  });

  bot.hears(["📌 Мои задачи", "➕ Создать задачу", "ℹ️ Помощь"], async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    await ctx.reply("Not implemented yet");
  });

  bot.command("admin", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    await ctx.reply("Admin menu", adminMenuKeyboard());
  });

  bot.command("admin_set_assigner", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    const text = (ctx.message as { text?: string }).text ?? "";
    const parts = text.trim().split(/\s+/);
    const workspaceId = parts[1];
    const userId = parts[2];
    if (!workspaceId || !userId) {
      await ctx.reply("Send: /admin_set_assigner <workspaceId> <userId>");
      return;
    }
    try {
      const result = await workspaceAdminService.setAssigner(workspaceId, userId, false);
      logAdminAction({
        handler: "admin_set_assigner",
        adminUserId: ctx.from.id,
        workspaceId,
        targetUserId: userId,
        result: "OK"
      });
      await ctx.reply(`Assigner set: ${result.assignerUserId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logAdminAction({
        handler: "admin_set_assigner",
        adminUserId: ctx.from.id,
        workspaceId,
        targetUserId: userId,
        result: "ERROR",
        errorCode: message.includes("already")
          ? "ASSIGNER_ALREADY_SET"
          : message.includes("not found")
            ? "WORKSPACE_NOT_FOUND"
            : "UNKNOWN"
      });
      await ctx.reply(message.includes("already") ? "Assigner already set" : "No workspace found");
    }
  });

  bot.command("admin_replace_assigner", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    const text = (ctx.message as { text?: string }).text ?? "";
    const parts = text.trim().split(/\s+/);
    const workspaceId = parts[1];
    const userId = parts[2];
    if (!workspaceId || !userId) {
      await ctx.reply("Send: /admin_replace_assigner <workspaceId> <userId>");
      return;
    }
    try {
      const result = await workspaceAdminService.setAssigner(workspaceId, userId, true);
      logAdminAction({
        handler: "admin_replace_assigner",
        adminUserId: ctx.from.id,
        workspaceId,
        targetUserId: userId,
        result: "OK"
      });
      await ctx.reply(`Assigner set: ${result.assignerUserId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logAdminAction({
        handler: "admin_replace_assigner",
        adminUserId: ctx.from.id,
        workspaceId,
        targetUserId: userId,
        result: "ERROR",
        errorCode: message.includes("not found") ? "WORKSPACE_NOT_FOUND" : "UNKNOWN"
      });
      await ctx.reply("No workspace found");
    }
  });

  bot.command("admin_reset", async (ctx) => {
    const phrase = "CONFIRM_DELETE_ALL_TEST_DATA";
    if (ctx.chat.type !== "private") {
      await ctx.reply("DM only");
      return;
    }
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("forbidden");
      return;
    }
    const text = (ctx.message as { text?: string }).text ?? "";
    const parts = text.trim().split(/\s+/);
    const confirmed = parts[1] === phrase;
    if (!allowAdminReset) {
      logAdminReset({
        adminUserId: ctx.from.id,
        chatId: ctx.chat.id,
        enabled: allowAdminReset,
        confirmed,
        errorCode: "RESET_DISABLED",
        errorDescription: "ALLOW_ADMIN_RESET is not true"
      });
      await ctx.reply("reset disabled");
      return;
    }
    if (!confirmed) {
      logAdminReset({
        adminUserId: ctx.from.id,
        chatId: ctx.chat.id,
        enabled: allowAdminReset,
        confirmed,
        errorCode: "CONFIRMATION_MISMATCH",
        errorDescription: "invalid confirmation phrase"
      });
      await ctx.reply("Send: /admin_reset CONFIRM_DELETE_ALL_TEST_DATA");
      return;
    }
    try {
      const deletedCounts = await workspaceAdminService.resetAllWorkspaceData();
      logAdminReset({
        adminUserId: ctx.from.id,
        chatId: ctx.chat.id,
        enabled: allowAdminReset,
        confirmed,
        deletedCounts
      });
      await ctx.reply(
        `Reset done: WorkspaceMember=${deletedCounts.workspaceMembers}, WorkspaceInvite=${deletedCounts.workspaceInvites}, Workspace=${deletedCounts.workspaces}`
      );
    } catch (error: unknown) {
      const description = error instanceof Error ? error.message : String(error);
      logAdminReset({
        adminUserId: ctx.from.id,
        chatId: ctx.chat.id,
        enabled: allowAdminReset,
        confirmed,
        errorCode: "RESET_FAILED",
        errorDescription: description
      });
      await ctx.reply("reset failed");
    }
  });

  bot.hears(["Admin"], async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    await ctx.reply("Admin menu", adminMenuKeyboard());
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

  bot.action(/^admin_create_team$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    const created = await workspaceAdminService.createWorkspaceManual("Admin Team");
    await ctx.reply(`Team created: ${created.id}`);
  });

  bot.action(/^admin_generate_invite$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    try {
      const invite = await workspaceAdminService.createInviteForLatest(null);
      await ctx.reply(`Invite link: https://t.me/${botUsername}?start=join_${invite.token}`);
    } catch {
      await ctx.reply("No workspace found");
    }
  });

  bot.action(/^admin_set_assigner$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    try {
      const latestWorkspaceId = await workspaceAdminService.getLatestWorkspaceId();
      const usage = "Send: /admin_set_assigner <workspaceId> <userId>";
      const hint = latestWorkspaceId
        ? `${usage}\nLatest workspaceId: ${latestWorkspaceId}`
        : usage;
      await ctx.reply(hint);
      logAdminAction({
        handler: "admin_set_assigner_button",
        adminUserId: ctx.from.id,
        workspaceId: latestWorkspaceId,
        targetUserId: null,
        result: "OK"
      });
    } catch {
      await ctx.reply("Send: /admin_set_assigner <workspaceId> <userId>");
      logAdminAction({
        handler: "admin_set_assigner_button",
        adminUserId: ctx.from.id,
        workspaceId: null,
        targetUserId: null,
        result: "ERROR",
        errorCode: "LATEST_WORKSPACE_READ_FAILED"
      });
    }
  });

  bot.action(/^draft_assignee:([^:]+):([^:]+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    const assigneeId = ctx.match[2];
    await ctx.answerCbQuery();

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await taskService.setDraftAssignee(tokenForTask, String(ctx.from.id), assigneeId);
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        `Task already exists (id: ${result.task.id})`,
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }
    if (result.status === "NOT_FOUND") {
      await updateOrReply(ctx, "Draft not found", Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    logStep(
      ctx,
      "draft_assignee",
      tokenForTask,
      "step_choose_priority",
      callbackChatId,
      callbackMsgId
    );
    await updateOrReply(ctx, "Choose priority", priorityKeyboard(tokenForTask).reply_markup);
  });

  bot.action(/^draft_priority:([^:]+):([^:]+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    const priority = ctx.match[2];
    await ctx.answerCbQuery();
    if (!isTaskPriority(priority)) {
      await updateOrReply(ctx, "Invalid priority", Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await taskService.setDraftPriority(tokenForTask, String(ctx.from.id), priority);
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        `Task already exists (id: ${result.task.id})`,
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }
    if (result.status === "NOT_FOUND") {
      await updateOrReply(ctx, "Draft not found", Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    logStep(
      ctx,
      "draft_priority",
      tokenForTask,
      "step_choose_deadline",
      callbackChatId,
      callbackMsgId
    );
    await updateOrReply(ctx, "Choose deadline", deadlineKeyboard(tokenForTask).reply_markup);
  });

  bot.action(/^draft_deadline:([^:]+):([^:]+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    const choice = ctx.match[2];
    await ctx.answerCbQuery();
    if (choice !== "today" && choice !== "tomorrow" && choice !== "none" && choice !== "manual") {
      await updateOrReply(ctx, "Invalid deadline", Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await taskService.setDraftDeadlineChoice(tokenForTask, String(ctx.from.id), choice);
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        `Task already exists (id: ${result.task.id})`,
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }
    if (result.status === "NOT_FOUND") {
      await updateOrReply(ctx, "Draft not found", Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    if (choice === "manual") {
      logStep(
        ctx,
        "draft_deadline",
        tokenForTask,
        "step_await_deadline_input",
        callbackChatId,
        callbackMsgId
      );
      await updateOrReply(ctx, "Send deadline date in YYYY-MM-DD", Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    logStep(ctx, "draft_deadline", tokenForTask, "step_confirm", callbackChatId, callbackMsgId);
    await updateOrReply(ctx, "Confirm task creation", confirmKeyboard(tokenForTask).reply_markup);
  });

  bot.action(/^draft_confirm:(.+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    await ctx.answerCbQuery();

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await taskService.finalizeDraft(tokenForTask, String(ctx.from.id));
    if (!result) {
      await updateOrReply(ctx, "Draft not found", Markup.inlineKeyboard([]).reply_markup);
      return;
    }
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        `Task already exists (id: ${result.task.id})`,
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }

    logStep(ctx, "draft_confirm", tokenForTask, "step_final", callbackChatId, callbackMsgId);
    await updateOrReply(
      ctx,
      `Task created (id: ${result.task.id})`,
      Markup.inlineKeyboard([]).reply_markup
    );
  });

  bot.on("text", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    const message = ctx.message as { text?: string };
    const text = message.text?.trim() ?? "";
    if (!text || text.startsWith("/")) {
      return;
    }

    const result = await taskService.setDraftDeadlineFromText(String(ctx.from.id), text);
    if (result.status === "NOT_FOUND") {
      return;
    }
    if (result.status === "INVALID_DATE") {
      await ctx.reply("Invalid date. Use YYYY-MM-DD");
      return;
    }

    await ctx.reply("Confirm task creation", confirmKeyboard(result.draft.token));
  });

  return bot;
}
