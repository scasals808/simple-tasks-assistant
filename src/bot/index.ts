import { Markup, Telegraf } from "telegraf";

import type { TaskPriority } from "../domain/tasks/task.types.js";
import type { TaskService } from "../domain/tasks/task.service.js";
import type { WorkspaceInviteService } from "../domain/workspaces/workspace-invite.service.js";
import type { WorkspaceAdminService } from "../domain/workspaces/workspace-admin.service.js";
import type { WorkspaceService } from "../domain/workspaces/workspace.service.js";
import type { WorkspaceMemberService } from "../domain/workspaces/workspace-member.service.js";
import { isAdmin } from "../config/env.js";
import { handleStartJoin } from "./start/handlers/start.join.js";
import { handleStartPlain } from "./start/handlers/start.plain.js";
import { handleStartTask } from "./start/handlers/start.task.js";
import {
  extractStartPayload,
  parseStartPayload,
  selectStartRoute
} from "./start/start.router.js";

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
    [Markup.button.callback("Generate invite link", "admin_generate_invite")]
  ]);
}

function logAdminAction(input: {
  handler: string;
  adminUserId?: number;
  workspaceId?: string | null;
  isOwner?: boolean | null;
  targetUserId?: string | null;
  result: "OK" | "ERROR";
  errorCode?: string | null;
}): void {
  const payload = {
    handler: input.handler,
    admin_user_id: input.adminUserId ?? null,
    workspaceId: input.workspaceId ?? null,
    is_owner: input.isOwner ?? null,
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

function logAdminCreateTeam(input: {
  adminUserId?: number;
  chatId?: string | null;
  title?: string | null;
  result: "created" | "existing" | "error";
  workspaceId?: string | null;
  errorCode?: string | null;
}): void {
  const payload = {
    handler: "admin_create_team",
    admin_user_id: input.adminUserId ?? null,
    chatId: input.chatId ?? null,
    title: input.title ?? null,
    result: input.result,
    workspaceId: input.workspaceId ?? null,
    error_code: input.errorCode ?? null
  };
  if (input.result === "error") {
    console.warn("[bot.admin_create_team]", payload);
    return;
  }
  console.log("[bot.admin_create_team]", payload);
}

function logAdminCreateTeamReject(input: {
  adminUserId?: number;
  chatIdInput?: string | null;
  rejectReason: "chatId_must_be_negative";
}): void {
  console.warn("[bot.admin_create_team]", {
    handler: "admin_create_team",
    admin_user_id: input.adminUserId ?? null,
    chatId_input: input.chatIdInput ?? null,
    reject_reason: input.rejectReason
  });
}

function logMenuRender(input: {
  userId?: number;
  isAdminUser: boolean;
  buttonsRenderedCount: number;
}): void {
  console.log("[bot.menu_render]", {
    handler: "menu_render",
    user_id: input.userId ?? null,
    is_admin: input.isAdminUser,
    buttons_rendered_count: input.buttonsRenderedCount
  });
}

function formatDueDate(value: Date | null): string {
  if (!value) {
    return "-";
  }
  return value.toISOString().slice(0, 10);
}

function shortenText(value: string, max = 24): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) {
    return "-";
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function renderTaskListHeader(kind: "assigned" | "created", count: number): string {
  return kind === "assigned" ? `📥 Мне назначено (${count})` : `✍️ Я создал (${count})`;
}

function renderTaskLine(task: {
  id: string;
  priority: string;
  deadlineAt: Date | null;
  sourceText: string;
  status: string;
}): string {
  return `[${task.priority}] due ${formatDueDate(task.deadlineAt)} ${shortenText(task.sourceText)} ${task.status} (${task.id})`;
}

function logTaskList(input: {
  handler: "list_assigned_tasks" | "list_created_tasks";
  userId: string;
  workspaceId: string | null;
  count: number;
  queryMs: number;
  errorCode?: string | null;
}): void {
  const payload = {
    handler: input.handler,
    user_id: input.userId,
    workspaceId: input.workspaceId,
    count: input.count,
    query_ms: input.queryMs,
    error_code: input.errorCode ?? null
  };
  if (input.errorCode) {
    console.warn("[bot.task_list]", payload);
    return;
  }
  console.log("[bot.task_list]", payload);
}

export function buildMainMenuRows(
  userId: number | undefined,
  adminUserIds: Set<string>
): string[][] {
  const isAdminUser = typeof userId === "number" && isAdmin(userId, adminUserIds);
  const rows: string[][] = [["📥 Мне назначено", "✍️ Я создал"], ["➕ Создать задачу", "ℹ️ Помощь"]];
  if (isAdminUser) {
    rows.push(["Admin"]);
  }
  return rows;
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
  workspaceService: WorkspaceService,
  workspaceMemberService: WorkspaceMemberService,
  workspaceInviteService: WorkspaceInviteService,
  workspaceAdminService: WorkspaceAdminService,
  adminUserIds: Set<string>,
  allowAdminReset: boolean
): Telegraf {
  const bot = new Telegraf(token);

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
      const workspaceId = await workspaceMemberService.findLatestWorkspaceIdForUser(userId);
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
          ? await taskService.listAssignedTasks({ workspaceId, viewerUserId: userId, limit: 20 })
          : await taskService.listCreatedTasks({ workspaceId, viewerUserId: userId, limit: 20 });
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
      await handleStartTask(ctx, taskService, parsed.token, async (draftToken, sourceChatId) => {
        const workspace = await workspaceService.findWorkspaceByChatId(sourceChatId);
        if (!workspace) {
          return Markup.inlineKeyboard([
            [
              Markup.button.callback(
                String(ctx.from.id),
                `draft_assignee:${draftToken}:${String(ctx.from.id)}`
              )
            ]
          ]);
        }
        const members = await workspaceMemberService.listWorkspaceMembers(workspace.id);
        const rows = members.map((member) => [
          Markup.button.callback(
            `${member.userId} (${member.role})`,
            `draft_assignee:${draftToken}:${member.userId}`
          )
        ]);
        return Markup.inlineKeyboard(
          rows.length > 0
            ? rows
            : [[Markup.button.callback(String(ctx.from.id), `draft_assignee:${draftToken}:${String(ctx.from.id)}`)]]
        );
      });
      return;
    }
    const rows = buildMainMenuRows(ctx.from?.id, adminUserIds);
    const count = rows.reduce((acc, row) => acc + row.length, 0);
    logMenuRender({
      userId: ctx.from?.id,
      isAdminUser: typeof ctx.from?.id === "number" && isAdmin(ctx.from.id, adminUserIds),
      buttonsRenderedCount: count
    });
    await handleStartPlain(
      ctx,
      Markup.keyboard(rows).resize()
    );
  });

  bot.hears(["📥 Мне назначено", "✍️ Я создал", "➕ Создать задачу", "ℹ️ Помощь"], async (ctx) => {
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
    await ctx.reply("Not implemented yet");
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

  bot.command("admin_create_team", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    if (!isAdmin(String(ctx.from.id), adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    const text = (ctx.message as { text?: string }).text ?? "";
    const parts = text.trim().split(/\s+/);
    const chatId = parts[1];
    const title = parts.slice(2).join(" ").trim() || undefined;
    if (!chatId || !/^-?\d+$/.test(chatId)) {
      await ctx.reply("Send: /admin_create_team <chatId> [title...]");
      return;
    }
    if (!chatId.startsWith("-")) {
      logAdminCreateTeamReject({
        adminUserId: ctx.from.id,
        chatIdInput: chatId,
        rejectReason: "chatId_must_be_negative"
      });
      await ctx.reply(
        "Invalid chatId. For groups use negative chatId (usually -100...). Get it via /debug_chat_id in the group."
      );
      return;
    }
    try {
      const result = await workspaceService.ensureWorkspaceForChatWithResult(chatId, title);
      if (result.result === "created") {
        await workspaceAdminService.setOwner(result.workspace.id, String(ctx.from.id), false);
        await workspaceMemberService.upsertOwnerMembership(result.workspace.id, String(ctx.from.id));
      }
      logAdminCreateTeam({
        adminUserId: ctx.from.id,
        chatId,
        title: title ?? null,
        result: result.result,
        workspaceId: result.workspace.id
      });
      await ctx.reply(
        `Team created/exists: workspaceId=${result.workspace.id} | chatId=${chatId} | title=${result.workspace.title ?? ""}`
      );
    } catch {
      logAdminCreateTeam({
        adminUserId: ctx.from.id,
        chatId,
        title: title ?? null,
        result: "error",
        workspaceId: null,
        errorCode: "CREATE_TEAM_FAILED"
      });
      await ctx.reply("create team failed");
    }
  });

  async function handleAdminSetOwnerCommand(
    ctx: {
      chat: { type: string };
      from: { id: number };
      message: { text?: string };
      reply(text: string): Promise<unknown>;
    },
    replace: boolean
  ): Promise<void> {
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
      await ctx.reply(
        replace
          ? "Send: /admin_replace_owner <workspaceId> <userId>"
          : "Send: /admin_set_owner <workspaceId> <userId>"
      );
      return;
    }
    try {
      const ownerCheck = await workspaceAdminService.isOwner(workspaceId, String(ctx.from.id));
      console.log("[bot.permission_check]", {
        handler: replace ? "admin_replace_owner" : "admin_set_owner",
        user_id: ctx.from.id,
        workspaceId,
        is_owner: ownerCheck
      });
      const result = await workspaceAdminService.setOwner(workspaceId, userId, replace);
      logAdminAction({
        handler: replace ? "admin_replace_owner" : "admin_set_owner",
        adminUserId: ctx.from.id,
        workspaceId,
        isOwner: ownerCheck,
        targetUserId: userId,
        result: "OK"
      });
      await ctx.reply(`Owner set: ${result.ownerUserId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logAdminAction({
        handler: replace ? "admin_replace_owner" : "admin_set_owner",
        adminUserId: ctx.from.id,
        workspaceId,
        isOwner: null,
        targetUserId: userId,
        result: "ERROR",
        errorCode: message.includes("already")
          ? "OWNER_ALREADY_SET"
          : message.includes("not found")
            ? "WORKSPACE_NOT_FOUND"
            : "UNKNOWN"
      });
      await ctx.reply(message.includes("already") ? "Owner already set" : "No workspace found");
    }
  }

  bot.command("admin_set_owner", async (ctx) => {
    await handleAdminSetOwnerCommand(
      ctx as unknown as {
        chat: { type: string };
        from: { id: number };
        message: { text?: string };
        reply(text: string): Promise<unknown>;
      },
      false
    );
  });

  bot.command("admin_replace_owner", async (ctx) => {
    await handleAdminSetOwnerCommand(
      ctx as unknown as {
        chat: { type: string };
        from: { id: number };
        message: { text?: string };
        reply(text: string): Promise<unknown>;
      },
      true
    );
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
      workspaceId: (await workspaceService.findWorkspaceByChatId(String(message.chat.id)))?.id ?? null,
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
    await ctx.reply("Send: /admin_create_team <chatId> [title...]");
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
