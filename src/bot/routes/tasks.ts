import { Markup, type Telegraf } from "telegraf";

import type { BotDeps } from "../types.js";
import { ru } from "../texts/ru.js";
import { buildSourceLink, taskActionsKeyboard } from "../ui/keyboards.js";
import { formatDueDate, renderTaskCard, renderTaskLine, renderTaskListHeader, shortenText } from "../ui/messages.js";
import { logDmCreateTask, logGroupTask, logStep, logTaskList } from "./logging.js";

export function registerTaskRoutes(bot: Telegraf, deps: BotDeps): void {
  function createActionNonce(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function createReassignNonce(): string {
    // Keep callback_data under Telegram 64-byte limit.
    return `${Date.now().toString(36).slice(-2)}${Math.random().toString(36).slice(2, 5)}`;
  }

  async function updateOrReply(
    ctx: {
      editMessageText(text: string, extra?: { reply_markup?: unknown }): Promise<unknown>;
      reply(text: string, extra?: unknown): Promise<unknown>;
    },
    text: string,
    replyMarkup?: unknown
  ): Promise<void> {
    try {
      await ctx.editMessageText(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    } catch {
      await ctx.reply(text, replyMarkup ? { reply_markup: replyMarkup } : undefined);
    }
  }

  async function notifyOwnerOnReviewSubmitted(
    ctx: { telegram: { sendMessage(chatId: string, text: string, extra?: unknown): Promise<unknown> } },
    input: {
      workspaceId: string | null;
      taskId: string;
      sourceText: string;
      assigneeUserId: string;
      priority: string;
      deadlineAt: Date | null;
    }
  ): Promise<void> {
    if (!input.workspaceId) {
      return;
    }

    const workspace = await deps.workspaceService.findWorkspaceById(input.workspaceId);
    if (!workspace?.ownerUserId) {
      return;
    }

    const members = await deps.workspaceMemberService.listWorkspaceMembers(input.workspaceId);
    const assignee = members.find((member) => member.userId === input.assigneeUserId);
    const assigneeDisplayName = assignee
      ? renderMemberDisplayName(assignee)
      : `id:${input.assigneeUserId}`;

    const title = shortenText(input.sourceText, 64);
    const text = [
      ru.ownerNotification.title(title),
      ru.ownerNotification.assignee(assigneeDisplayName),
      ru.ownerNotification.priority(input.priority),
      ru.ownerNotification.deadline(formatDueDate(input.deadlineAt))
    ].join("\n");

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(ru.buttons.openTask, `task_open:${input.taskId}`)]
    ]);

    try {
      await ctx.telegram.sendMessage(workspace.ownerUserId, text, keyboard);
    } catch (error: unknown) {
      const err = error as { response?: { error_code?: number } };
      const errorCode = err.response?.error_code ?? null;
      if (errorCode === 400 || errorCode === 403) {
        console.warn("[bot.owner_notify.failed]", {
          ownerId: workspace.ownerUserId,
          taskId: input.taskId,
          error_code: errorCode
        });
        return;
      }
      throw error;
    }
  }

  async function notifyAssigneeOnOwnerAction(
    ctx: { telegram: { sendMessage(chatId: string, text: string, extra?: unknown): Promise<unknown> } },
    input: {
      assigneeUserId: string;
      taskId: string;
      text: string;
    }
  ): Promise<void> {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(ru.buttons.openTask, `task_open:${input.taskId}`)]
    ]);
    try {
      await ctx.telegram.sendMessage(input.assigneeUserId, input.text, keyboard);
    } catch (error: unknown) {
      const err = error as { response?: { error_code?: number } };
      const errorCode = err.response?.error_code ?? null;
      if (errorCode === 400 || errorCode === 403) {
        console.warn("[bot.assignee_notify.failed]", {
          userId: input.assigneeUserId,
          taskId: input.taskId,
          error_code: errorCode
        });
        return;
      }
      throw error;
    }
  }

  async function notifyReassignUser(
    ctx: { telegram: { sendMessage(chatId: string, text: string, extra?: unknown): Promise<unknown> } },
    input: {
      userId: string;
      taskId: string;
      text: string;
      withOpenTaskButton: boolean;
    }
  ): Promise<void> {
    const keyboard = input.withOpenTaskButton
      ? Markup.inlineKeyboard([[Markup.button.callback(ru.buttons.openTask, `task_open:${input.taskId}`)]])
      : undefined;
    try {
      await ctx.telegram.sendMessage(input.userId, input.text, keyboard);
    } catch (error: unknown) {
      const err = error as { response?: { error_code?: number } };
      const errorCode = err.response?.error_code ?? null;
      if (errorCode === 400 || errorCode === 403) {
        console.warn("[bot.reassign_notify.failed]", {
          userId: input.userId,
          taskId: input.taskId,
          error_code: errorCode
        });
        return;
      }
      throw error;
    }
  }

  async function canOwnerReviewTask(task: { workspaceId: string | null }, viewerUserId: string): Promise<boolean> {
    if (!task.workspaceId) {
      return false;
    }
    const workspace = await deps.workspaceService.findWorkspaceById(task.workspaceId);
    return workspace?.ownerUserId === viewerUserId;
  }

  async function isWorkspaceOwner(workspaceId: string, userId: string): Promise<boolean> {
    const workspace = await deps.workspaceService.findWorkspaceById(workspaceId);
    return workspace?.ownerUserId === userId;
  }

  async function replyTaskCardWithActions(
    ctx: {
      editMessageText(text: string, extra?: { reply_markup?: unknown }): Promise<unknown>;
      reply(text: string, extra?: unknown): Promise<unknown>;
    },
    task: {
      id: string;
      workspaceId: string | null;
      sourceText: string;
      assigneeUserId: string;
      priority: string;
      deadlineAt: Date | null;
      status: string;
      sourceChatId: string;
      sourceMessageId: string;
      sourceLink: string | null;
      creatorUserId: string;
      submittedForReviewAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      lastReturnComment: string | null;
      lastReturnAt: Date | null;
      lastReturnByUserId: string | null;
    },
    viewerUserId: string
  ): Promise<void> {
    let assigneeDisplayName: string | undefined;
    let assigneeRemoved = false;
    if (task.workspaceId) {
      const assigneeMember = await deps.workspaceMemberService.findMember(
        task.workspaceId,
        task.assigneeUserId
      );
      if (assigneeMember) {
        assigneeDisplayName = renderMemberDisplayName(assigneeMember);
        assigneeRemoved = assigneeMember.status === "REMOVED";
      }
    }
    const ownerReviewActions = await canOwnerReviewTask(task, viewerUserId);
    await updateOrReply(
      ctx,
      renderTaskCard(task, viewerUserId, assigneeDisplayName, assigneeRemoved),
      taskActionsKeyboard(
        {
          id: task.id,
          sourceText: task.sourceText,
          assigneeUserId: task.assigneeUserId,
          status: task.status
        },
        viewerUserId,
        createActionNonce(),
        ownerReviewActions,
        true,
        ownerReviewActions
      ).reply_markup
    );
  }

  function renderMemberDisplayName(member: {
    userId: string;
    tgFirstName: string | null;
    tgLastName: string | null;
    tgUsername: string | null;
  }): string {
    const fullName = `${member.tgFirstName ?? ""} ${member.tgLastName ?? ""}`.trim();
    if (fullName) {
      return fullName;
    }
    if (member.tgUsername) {
      return `@${member.tgUsername}`;
    }
    return `id:${member.userId}`;
  }

  async function handleTaskList(
    ctx: {
      from: { id: number; first_name?: string; last_name?: string; username?: string };
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
      await deps.workspaceMemberService.touchLatestMembershipProfile(userId, {
        tgFirstName: ctx.from.first_name ?? null,
        tgLastName: ctx.from.last_name ?? null,
        tgUsername: ctx.from.username ?? null
      });

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

      const body = result.tasks.map((task, index) => renderTaskLine(task, index)).join("\n\n");
      const workspace = await deps.workspaceService.findWorkspaceById(workspaceId);
      const ownerReviewActions = workspace?.ownerUserId === userId;
      const actionButtons = result.tasks.map((task) =>
        taskActionsKeyboard(
          {
            id: task.id,
            sourceText: task.sourceText,
            assigneeUserId: task.assigneeUserId,
            status: task.status
          },
          userId,
          createActionNonce(),
          ownerReviewActions
        ).reply_markup?.inline_keyboard?.[0] ?? []
      );
      logTaskList({
        handler: kind === "assigned" ? "list_assigned_tasks" : "list_created_tasks",
        userId,
        workspaceId,
        count: result.tasks.length,
        queryMs: Date.now() - startedAt
      });
      await ctx.reply(`${header}\n${body}`, Markup.inlineKeyboard(actionButtons));
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
    from: { id: number; first_name?: string; last_name?: string; username?: string };
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
    await deps.workspaceMemberService.touchLatestMembershipProfile(userId, {
      tgFirstName: ctx.from.first_name ?? null,
      tgLastName: ctx.from.last_name ?? null,
      tgUsername: ctx.from.username ?? null
    });
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

  async function handleOnReviewList(ctx: {
    from: { id: number; first_name?: string; last_name?: string; username?: string };
    reply(text: string, extra?: unknown): Promise<unknown>;
  }): Promise<void> {
    const userId = String(ctx.from.id);
    const startedAt = Date.now();
    try {
      const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(userId);
      if (!workspaceId) {
        logTaskList({
          handler: "list_on_review_tasks",
          userId,
          workspaceId: null,
          count: 0,
          queryMs: Date.now() - startedAt,
          errorCode: "NOT_IN_WORKSPACE"
        });
        await ctx.reply(ru.taskList.joinTeamFirst);
        return;
      }

      await deps.workspaceMemberService.touchLatestMembershipProfile(userId, {
        tgFirstName: ctx.from.first_name ?? null,
        tgLastName: ctx.from.last_name ?? null,
        tgUsername: ctx.from.username ?? null
      });
      const workspace = await deps.workspaceService.findWorkspaceById(workspaceId);
      if (workspace?.ownerUserId === userId) {
        await deps.workspaceMemberService.upsertOwnerMembership(workspaceId, userId, {
          tgFirstName: ctx.from.first_name ?? null,
          tgLastName: ctx.from.last_name ?? null,
          tgUsername: ctx.from.username ?? null
        });
      }

      const result = await deps.taskService.listOnReviewTasks({
        workspaceId,
        viewerUserId: userId,
        limit: 20
      });
      if (result.status === "NOT_IN_WORKSPACE") {
        await ctx.reply(ru.taskList.joinTeamFirst);
        return;
      }
      if (result.status === "NOT_OWNER") {
        await ctx.reply(ru.reviewList.onlyOwner);
        return;
      }

      if (result.tasks.length === 0) {
        await ctx.reply(`${ru.reviewList.header(0)}\n${ru.reviewList.empty}`);
        return;
      }

      const members = await deps.workspaceMemberService.listWorkspaceMembers(workspaceId);
      const assigneeNameByUserId = new Map(members.map((member) => [member.userId, renderMemberDisplayName(member)]));
      const body = result.tasks
        .map((task, index) => {
          const color = task.priority === "P1" ? "🔴" : task.priority === "P2" ? "🟠" : "🟡";
          const title = shortenText(task.sourceText, 40);
          const assignee = assigneeNameByUserId.get(task.assigneeUserId) ?? `id:${task.assigneeUserId}`;
          return `${index + 1}) ${color} ${task.priority} • ${title}\n👤 ${assignee}\n⏰ ${formatDueDate(task.deadlineAt)}`;
        })
        .join("\n\n");
      const buttons = result.tasks.map((task) => [
        Markup.button.callback(
          `${ru.buttons.contextPlain}: ${shortenText(task.sourceText, 24)}`,
          `task_open:${task.id}`
        )
      ]);
      await ctx.reply(`${ru.reviewList.header(result.tasks.length)}\n\n${body}`, Markup.inlineKeyboard(buttons));
    } catch {
      await ctx.reply(ru.reviewList.loadFailed);
    }
  }

  async function handleMembersList(ctx: {
    from: { id: number };
    reply(text: string, extra?: unknown): Promise<unknown>;
  }): Promise<void> {
    const userId = String(ctx.from.id);
    const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(userId);
    if (!workspaceId) {
      await ctx.reply(ru.taskList.joinTeamFirst);
      return;
    }
    if (!(await isWorkspaceOwner(workspaceId, userId))) {
      await ctx.reply(ru.members.onlyOwner);
      return;
    }
    const members = await deps.workspaceMemberService.listWorkspaceMembers(workspaceId);
    if (members.length === 0) {
      await ctx.reply(ru.members.empty);
      return;
    }
    const lines = members.map((member, index) => {
      const display = renderMemberDisplayName(member);
      const username = member.tgUsername && !display.startsWith("@") ? ` (@${member.tgUsername})` : "";
      return `${index + 1}) ${display}${username}`;
    });
    const buttons = members.map((member) => [
      Markup.button.callback(
        `${ru.buttons.membersRemove}: ${shortenText(renderMemberDisplayName(member), 24)}`,
        `member:remove:ask:${member.userId}`
      )
    ]);
    await ctx.reply(`${ru.members.header}\n\n${lines.join("\n")}`, Markup.inlineKeyboard(buttons));
  }

  bot.hears(
    ["📥 Мне назначено", "✍️ Я создал", "➕ Новая задача", "ℹ️ Помощь", ru.menu.onReview, ru.menu.members],
    async (ctx) => {
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
    if (text === ru.menu.onReview) {
      await handleOnReviewList(
        ctx as unknown as {
          from: { id: number; first_name?: string; last_name?: string; username?: string };
          reply(text: string, extra?: unknown): Promise<unknown>;
        }
      );
      return;
    }
    if (text === ru.menu.members) {
      await handleMembersList(
        ctx as unknown as {
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

  bot.action(/^members:list$/, async (ctx) => {
    await ctx.answerCbQuery();
    await handleMembersList(
      ctx as unknown as {
        from: { id: number };
        reply(text: string, extra?: unknown): Promise<unknown>;
      }
    );
  });

  bot.action(/^member:remove:ask:([^:]+)$/, async (ctx) => {
    const memberUserId = ctx.match[1];
    await ctx.answerCbQuery();
    const actorUserId = String(ctx.from.id);
    const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(actorUserId);
    if (!workspaceId || !(await isWorkspaceOwner(workspaceId, actorUserId))) {
      await ctx.reply(ru.members.onlyOwner);
      return;
    }
    const member = await deps.workspaceMemberService.findMember(workspaceId, memberUserId);
    if (!member || member.status !== "ACTIVE") {
      await ctx.reply(ru.members.notFound);
      return;
    }
    const nonce = createActionNonce();
    await updateOrReply(
      ctx,
      ru.members.removeAsk(renderMemberDisplayName(member)),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            ru.buttons.membersRemoveConfirm,
            `member:remove:confirm:${memberUserId}:${nonce}`
          )
        ],
        [Markup.button.callback(ru.buttons.membersRemoveCancel, `member:remove:cancel:${memberUserId}`)]
      ]).reply_markup
    );
  });

  bot.action(/^member:remove:confirm:([^:]+):([^:]+)$/, async (ctx) => {
    const memberUserId = ctx.match[1];
    await ctx.answerCbQuery();
    const actorUserId = String(ctx.from.id);
    const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(actorUserId);
    if (!workspaceId) {
      await ctx.reply(ru.taskList.joinTeamFirst);
      return;
    }
    const before = await deps.workspaceMemberService.findMember(workspaceId, memberUserId);
    const result = await deps.workspaceMemberService.removeMember({
      workspaceId,
      actorUserId,
      memberUserId
    });
    if (result.status === "FORBIDDEN") {
      await ctx.reply(ru.members.onlyOwner);
      return;
    }
    if (result.status === "NOT_FOUND") {
      await ctx.reply(ru.members.notFound);
      return;
    }
    if (result.status === "CANNOT_REMOVE_OWNER") {
      await ctx.reply(ru.members.cannotRemoveOwner);
      return;
    }
    if (result.status === "ALREADY_REMOVED") {
      await ctx.reply(ru.members.alreadyRemoved);
      return;
    }
    const removedName = before ? renderMemberDisplayName(before) : `id:${memberUserId}`;
    await ctx.reply(ru.members.removed(removedName));
  });

  bot.action(/^member:remove:cancel:([^:]+)$/, async (ctx) => {
    await ctx.answerCbQuery(ru.confirm.canceled);
    await updateOrReply(
      ctx,
      ru.members.header,
      Markup.inlineKeyboard([[Markup.button.callback(ru.menu.members, "members:list")]]).reply_markup
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
      from?: { id?: number; first_name?: string; last_name?: string; username?: string };
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
      const ensured = await deps.workspaceService.ensureWorkspaceForChatWithResult(
        chatId,
        message.chat.username
      );
      if (ensured.result === "created") {
        await deps.workspaceAdminService.setOwner(ensured.workspace.id, userId, false);
        await deps.workspaceMemberService.upsertOwnerMembership(ensured.workspace.id, userId, {
          tgFirstName: message.from.first_name ?? null,
          tgLastName: message.from.last_name ?? null,
          tgUsername: message.from.username ?? null
        });
      } else {
        if (ensured.workspace.ownerUserId === userId) {
          await deps.workspaceMemberService.upsertOwnerMembership(ensured.workspace.id, userId, {
            tgFirstName: message.from.first_name ?? null,
            tgLastName: message.from.last_name ?? null,
            tgUsername: message.from.username ?? null
          });
        } else {
          await deps.workspaceMemberService.upsertMemberRole(ensured.workspace.id, userId, {
            tgFirstName: message.from.first_name ?? null,
            tgLastName: message.from.last_name ?? null,
            tgUsername: message.from.username ?? null
          });
        }
      }

      const tokenForTask = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const draftResult = await deps.taskService.createOrReuseGroupDraft({
        token: tokenForTask,
        workspaceId: ensured.workspace.id,
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

  bot.action(/^task_(?:open|context):(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await ctx.answerCbQuery();
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.common.taskNotFound);
      return;
    }

    await replyTaskCardWithActions(ctx, task, viewerUserId);

  });

  bot.action(/^task_(?:done|submit_review):([^:]+):([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const nonce = ctx.match[2];
    await ctx.answerCbQuery();
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.submitForReview.taskNotFound);
      return;
    }
    const isSelfTask = task.creatorUserId === task.assigneeUserId && task.assigneeUserId === viewerUserId;
    if (isSelfTask) {
      const result = await deps.taskService.completeTask({
        taskId,
        actorUserId: viewerUserId,
        nonce
      });
      if (result.status === "SUCCESS") {
        await replyTaskCardWithActions(ctx, result.task, viewerUserId);
        await ctx.reply(ru.submitForReview.selfClosed);
        return;
      }
      if (result.status === "NOT_ASSIGNEE") {
        await ctx.reply(ru.submitForReview.notAllowed);
        return;
      }
      if (result.status === "NOT_IN_WORKSPACE") {
        await ctx.reply(ru.submitForReview.notInWorkspace);
        return;
      }
      await ctx.reply(ru.submitForReview.taskNotFound);
      return;
    }
    await updateOrReply(
      ctx,
      ru.submitForReview.confirmPrompt,
      Markup.inlineKeyboard([
        [Markup.button.callback(ru.buttons.confirm, `confirm:task_done:${taskId}:${nonce}`)],
        [Markup.button.callback(ru.buttons.cancel, `cancel:task_done:${taskId}:${nonce}`)]
      ]).reply_markup
    );
  });

  bot.action(/^confirm:task_(?:done|submit_review):([^:]+):([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const nonce = ctx.match[2];
    await ctx.answerCbQuery();

    const result = await deps.taskService.completeTask({
      taskId,
      actorUserId: String(ctx.from.id),
      nonce
    });

    if (result.status === "SUCCESS") {
      await replyTaskCardWithActions(ctx, result.task, String(ctx.from.id));
      if (result.mode === "self_closed") {
        await ctx.reply(ru.submitForReview.selfClosed);
        return;
      }
      if (result.changed) {
        await notifyOwnerOnReviewSubmitted(ctx, {
          workspaceId: result.task.workspaceId,
          taskId: result.task.id,
          sourceText: result.task.sourceText,
          assigneeUserId: result.task.assigneeUserId,
          priority: result.task.priority,
          deadlineAt: result.task.deadlineAt
        });
        await ctx.reply(ru.submitForReview.success);
        return;
      }
      await ctx.reply(ru.submitForReview.alreadyOnReview);
      return;
    }
    if (result.status === "NOT_ASSIGNEE") {
      await ctx.reply(ru.submitForReview.notAllowed);
      return;
    }
    if (result.status === "NOT_IN_WORKSPACE") {
      await ctx.reply(ru.submitForReview.notInWorkspace);
      return;
    }
    await ctx.reply(ru.submitForReview.taskNotFound);
  });

  bot.action(/^cancel:task_(?:done|submit_review):([^:]+):([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await ctx.answerCbQuery(ru.confirm.canceled);
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.common.taskNotFound);
      return;
    }
    await replyTaskCardWithActions(ctx, task, viewerUserId);
  });

  bot.action(/^task_accept:ask:([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const nonce = createActionNonce();
    await ctx.answerCbQuery();
    await updateOrReply(
      ctx,
      ru.acceptReview.confirmPrompt,
      Markup.inlineKeyboard([
        [Markup.button.callback(ru.buttons.acceptReviewConfirm, `task_accept:confirm:${taskId}:${nonce}`)],
        [Markup.button.callback(ru.buttons.cancel, `task_return:cancel:${taskId}`)]
      ]).reply_markup
    );
  });

  bot.action(/^task_accept:confirm:([^:]+):([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const nonce = ctx.match[2];
    await ctx.answerCbQuery();
    const before = await deps.taskService.getTaskForViewer(taskId, String(ctx.from.id));
    const result = await deps.taskService.acceptReview({
      taskId,
      actorUserId: String(ctx.from.id),
      nonce
    });
    if (result.status === "SUCCESS") {
      await replyTaskCardWithActions(ctx, result.task, String(ctx.from.id));
      const changed = before?.status === "ON_REVIEW" && result.task.status === "CLOSED";
      if (changed) {
        const title = shortenText(result.task.sourceText, 64);
        await notifyAssigneeOnOwnerAction(ctx, {
          assigneeUserId: result.task.assigneeUserId,
          taskId: result.task.id,
          text: ru.assigneeNotification.acceptedClosed(title)
        });
      }
      await ctx.reply(ru.acceptReview.success);
      return;
    }
    if (result.status === "FORBIDDEN") {
      await ctx.reply(ru.acceptReview.forbidden);
      return;
    }
    await ctx.reply(ru.acceptReview.taskNotFound);
  });

  bot.action(/^task_return:ask:([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const nonce = createActionNonce();
    await ctx.answerCbQuery();
    await updateOrReply(
      ctx,
      ru.returnToWork.confirmPromptWithComment,
      Markup.inlineKeyboard([
        [Markup.button.callback(ru.buttons.returnToWorkContinue, `task_return:continue:${taskId}:${nonce}`)],
        [Markup.button.callback(ru.buttons.cancel, `task_return:cancel:${taskId}`)]
      ]).reply_markup
    );
  });

  bot.action(/^task_return:continue:([^:]+):([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const nonce = ctx.match[2];
    await ctx.answerCbQuery();
    const result = await deps.taskService.beginReturnToWorkComment({
      taskId,
      actorUserId: String(ctx.from.id),
      nonce
    });
    if (result.status === "READY") {
      await ctx.reply(ru.returnToWork.askComment);
      return;
    }
    if (result.status === "FORBIDDEN") {
      await ctx.reply(ru.returnToWork.forbidden);
      return;
    }
    await ctx.reply(ru.returnToWork.taskNotFound);
  });

  bot.action(/^task_return:cancel:([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await ctx.answerCbQuery(ru.confirm.canceled);
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.common.taskNotFound);
      return;
    }
    await replyTaskCardWithActions(ctx, task, viewerUserId);
  });

  bot.action(/^task_reassign:pick:([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await ctx.answerCbQuery();
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.reassign.taskNotFound);
      return;
    }
    if (!task.workspaceId || !(await canOwnerReviewTask(task, viewerUserId))) {
      await ctx.reply(ru.reassign.forbidden);
      return;
    }
    const members = (await deps.workspaceMemberService.listWorkspaceMembers(task.workspaceId)).slice(0, 12);
    if (members.length === 0) {
      await ctx.reply(ru.reassign.invalidAssignee);
      return;
    }
    const buttons = members.map((member) => [
      Markup.button.callback(
        shortenText(renderMemberDisplayName(member), 28),
        `task_reassign:to:${task.id}:${member.userId}`
      )
    ]);
    const title = shortenText(task.sourceText, 48);
    await updateOrReply(
      ctx,
      `${ru.reassign.pickAssigneeForTask(title)}\n${ru.reassign.pickAssignee}`,
      Markup.inlineKeyboard(buttons).reply_markup
    );
  });

  bot.action(/^task_reassign:to:([^:]+):([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const newAssigneeId = ctx.match[2];
    await ctx.answerCbQuery();
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.reassign.taskNotFound);
      return;
    }
    if (!task.workspaceId || !(await canOwnerReviewTask(task, viewerUserId))) {
      await ctx.reply(ru.reassign.forbidden);
      return;
    }
    const assignee = await deps.workspaceMemberService.findActiveMember(task.workspaceId, newAssigneeId);
    if (!assignee) {
      await ctx.reply(ru.reassign.invalidAssignee);
      return;
    }
    const nonce = createReassignNonce();
    await updateOrReply(
      ctx,
      ru.reassign.confirmPrompt(shortenText(task.sourceText, 40), renderMemberDisplayName(assignee)),
      Markup.inlineKeyboard([
        [Markup.button.callback(ru.buttons.confirm, `task_reassign:confirm:${taskId}:${newAssigneeId}:${nonce}`)],
        [Markup.button.callback(ru.buttons.cancel, `task_reassign:cancel:${taskId}`)]
      ]).reply_markup
    );
  });

  bot.action(/^task_reassign:confirm:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const newAssigneeId = ctx.match[2];
    const nonce = ctx.match[3];
    await ctx.answerCbQuery();
    const viewerUserId = String(ctx.from.id);
    const before = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    const result = await deps.taskService.reassignTask({
      taskId,
      actorUserId: viewerUserId,
      newAssigneeId,
      nonce
    });
    if (result.status === "NOT_FOUND") {
      await ctx.reply(ru.reassign.taskNotFound);
      return;
    }
    if (result.status === "FORBIDDEN") {
      await ctx.reply(ru.reassign.forbidden);
      return;
    }
    if (result.status === "INVALID_ASSIGNEE") {
      await ctx.reply(ru.reassign.invalidAssignee);
      return;
    }
    if (result.status === "TASK_CLOSED") {
      await ctx.reply(ru.reassign.taskClosed);
      return;
    }
    await replyTaskCardWithActions(ctx, result.task, viewerUserId);
    if (!result.changed) {
      await ctx.reply(ru.reassign.noChanges);
      return;
    }
    const title = shortenText(result.task.sourceText, 64);
    await notifyReassignUser(ctx, {
      userId: result.task.assigneeUserId,
      taskId: result.task.id,
      text: ru.reassignNotification.assignedToYou(title),
      withOpenTaskButton: true
    });
    const previousAssigneeUserId = before?.assigneeUserId ?? null;
    if (previousAssigneeUserId && previousAssigneeUserId !== result.task.assigneeUserId) {
      await notifyReassignUser(ctx, {
        userId: previousAssigneeUserId,
        taskId: result.task.id,
        text: ru.reassignNotification.reassignedFromYou(title),
        withOpenTaskButton: false
      });
    }
    if (result.task.workspaceId) {
      const assignee = await deps.workspaceMemberService.findMember(
        result.task.workspaceId,
        result.task.assigneeUserId
      );
      const assigneeName = assignee ? renderMemberDisplayName(assignee) : `id:${result.task.assigneeUserId}`;
      await ctx.reply(ru.reassign.success(assigneeName));
      return;
    }
    await ctx.reply(ru.reassign.success(`id:${result.task.assigneeUserId}`));
  });

  bot.action(/^task_reassign:cancel:([^:]+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    await ctx.answerCbQuery(ru.confirm.canceled);
    const viewerUserId = String(ctx.from.id);
    const task = await deps.taskService.getTaskForViewer(taskId, viewerUserId);
    if (!task) {
      await ctx.reply(ru.reassign.taskNotFound);
      return;
    }
    await replyTaskCardWithActions(ctx, task, viewerUserId);
  });

  bot.on("text", async (ctx, next) => {
    if (ctx.chat.type !== "private") {
      return next();
    }
    const text = (ctx.message as { text?: string }).text ?? "";
    const result = await deps.taskService.applyReturnCommentFromDraft({
      actorUserId: String(ctx.from.id),
      comment: text
    });
    if (result.status === "NO_ACTIVE_DRAFT") {
      return next();
    }
    if (result.status === "SUCCESS") {
      await replyTaskCardWithActions(ctx, result.task, String(ctx.from.id));
      const comment = (result.task.lastReturnComment ?? "").trim();
      if (comment) {
        const title = shortenText(result.task.sourceText, 64);
        await notifyAssigneeOnOwnerAction(ctx, {
          assigneeUserId: result.task.assigneeUserId,
          taskId: result.task.id,
          text: ru.assigneeNotification.returnedToWork(title, comment)
        });
      }
      await ctx.reply(ru.returnToWork.success);
      return;
    }
    if (result.status === "FORBIDDEN") {
      await ctx.reply(ru.returnToWork.forbidden);
      return;
    }
    if (result.status === "NOT_FOUND") {
      await ctx.reply(ru.returnToWork.taskNotFound);
      return;
    }
    await ctx.reply(ru.returnToWork.noActiveDraft);
  });
}
