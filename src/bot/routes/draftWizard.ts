import { Markup, type Telegraf } from "telegraf";

import type { TaskPriority } from "../../domain/tasks/task.types.js";
import type { BotDeps } from "../types.js";
import { ru } from "../texts/ru.js";
import { formatDueDate, renderTaskCard, shortenText } from "../ui/messages.js";
import {
  confirmKeyboard,
  deadlineKeyboard,
  priorityKeyboard,
  taskActionsKeyboard
} from "../ui/keyboards.js";
import { logStep } from "./logging.js";

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

function createSubmitNonce(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function creatorLabel(from: {
  first_name?: string;
  last_name?: string;
  username?: string;
  id: number;
}): string {
  const fullName = `${from.first_name ?? ""} ${from.last_name ?? ""}`.trim();
  if (fullName) {
    return fullName;
  }
  if (from.username) {
    return `@${from.username}`;
  }
  return `id:${from.id}`;
}

function assigneeLabel(member: {
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
  return ru.buttons.fallbackAssignee(member.userId);
}

function memberDisplayName(member: {
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
  return ru.buttons.fallbackAssignee(member.userId);
}

async function buildAssigneeKeyboardByWorkspace(
  deps: BotDeps,
  fallbackUserId: string,
  tokenForTask: string,
  workspaceId: string | null
): Promise<unknown> {
  if (!workspaceId) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          ru.buttons.fallbackAssignee(fallbackUserId),
          `draft_assignee:${tokenForTask}:${fallbackUserId}`
        )
      ]
    ]);
  }
  const members = await deps.workspaceMemberService.listWorkspaceMembers(workspaceId);
  const rows = members.map((member) => [
    Markup.button.callback(assigneeLabel(member), `draft_assignee:${tokenForTask}:${member.userId}`)
  ]);
  return Markup.inlineKeyboard(
    rows.length > 0
      ? rows
      : [
          [
            Markup.button.callback(
              ru.buttons.fallbackAssignee(fallbackUserId),
              `draft_assignee:${tokenForTask}:${fallbackUserId}`
            )
          ]
        ]
  );
}

export function registerDraftWizardRoutes(bot: Telegraf, deps: BotDeps): void {
  async function notifyAssigneeOnCreated(
    ctx: {
      from: { id: number; first_name?: string; last_name?: string; username?: string };
      telegram: { sendMessage(chatId: string, text: string, extra?: unknown): Promise<unknown> };
    },
    task: {
      id: string;
      sourceText: string;
      creatorUserId: string;
      assigneeUserId: string;
      priority: string;
      deadlineAt: Date | null;
    }
  ): Promise<void> {
    if (task.assigneeUserId === task.creatorUserId) {
      return;
    }

    const title = shortenText(task.sourceText, 64);
    const text = [
      ru.assigneeNotification.title(title),
      ru.assigneeNotification.priority(task.priority),
      ru.assigneeNotification.deadline(formatDueDate(task.deadlineAt)),
      ru.assigneeNotification.assignedBy(creatorLabel(ctx.from))
    ].join("\n");

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback(ru.buttons.openTask, `task_open:${task.id}`)]
    ]);

    try {
      await ctx.telegram.sendMessage(task.assigneeUserId, text, keyboard);
    } catch (error: unknown) {
      const err = error as { response?: { error_code?: number } };
      const errorCode = err.response?.error_code ?? null;
      if (errorCode === 400 || errorCode === 403) {
        console.warn("[bot.assignee_notify.failed]", {
          assigneeId: task.assigneeUserId,
          taskId: task.id,
          error_code: errorCode
        });
        return;
      }
      throw error;
    }
  }

  bot.action(/^draft_assignee:([^:]+):([^:]+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    const assigneeId = ctx.match[2];
    await ctx.answerCbQuery();

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await deps.taskService.setDraftAssignee(tokenForTask, String(ctx.from.id), assigneeId);
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        ru.startTask.alreadyExists(result.task.id),
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }
    if (result.status === "NOT_FOUND") {
      await updateOrReply(ctx, ru.startTask.draftNotFound, Markup.inlineKeyboard([]).reply_markup);
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
    await updateOrReply(ctx, ru.wizard.choosePriority, priorityKeyboard(tokenForTask).reply_markup);
  });

  bot.action(/^draft_priority:([^:]+):([^:]+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    const priority = ctx.match[2];
    await ctx.answerCbQuery();
    if (!isTaskPriority(priority)) {
      await updateOrReply(ctx, ru.wizard.invalidPriority, Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await deps.taskService.setDraftPriority(tokenForTask, String(ctx.from.id), priority);
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        ru.startTask.alreadyExists(result.task.id),
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }
    if (result.status === "NOT_FOUND") {
      await updateOrReply(ctx, ru.startTask.draftNotFound, Markup.inlineKeyboard([]).reply_markup);
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
    await updateOrReply(ctx, ru.wizard.chooseDeadline, deadlineKeyboard(tokenForTask).reply_markup);
  });

  bot.action(/^draft_deadline:([^:]+):([^:]+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    const choice = ctx.match[2];
    await ctx.answerCbQuery();
    if (choice !== "today" && choice !== "tomorrow" && choice !== "none" && choice !== "manual") {
      await updateOrReply(ctx, ru.wizard.invalidDeadline, Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await deps.taskService.setDraftDeadlineChoice(tokenForTask, String(ctx.from.id), choice);
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        ru.startTask.alreadyExists(result.task.id),
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }
    if (result.status === "NOT_FOUND") {
      await updateOrReply(ctx, ru.startTask.draftNotFound, Markup.inlineKeyboard([]).reply_markup);
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
      await updateOrReply(ctx, ru.wizard.askDeadlineManual, Markup.inlineKeyboard([]).reply_markup);
      return;
    }

    logStep(ctx, "draft_deadline", tokenForTask, "step_confirm", callbackChatId, callbackMsgId);
    await updateOrReply(ctx, ru.wizard.confirmCreate, confirmKeyboard(tokenForTask).reply_markup);
  });

  bot.action(/^draft_confirm:(.+)$/, async (ctx) => {
    const tokenForTask = ctx.match[1];
    await ctx.answerCbQuery();

    const callbackMessage = "message" in ctx.callbackQuery ? ctx.callbackQuery.message : undefined;
    const callbackChatId = callbackMessage?.chat?.id ?? 0;
    const callbackMsgId = callbackMessage?.message_id ?? 0;

    const result = await deps.taskService.finalizeDraft(tokenForTask, String(ctx.from.id));
    if (!result) {
      await updateOrReply(ctx, ru.startTask.draftNotFound, Markup.inlineKeyboard([]).reply_markup);
      return;
    }
    if (result.status === "ALREADY_EXISTS") {
      await updateOrReply(
        ctx,
        ru.startTask.alreadyExists(result.task.id),
        Markup.inlineKeyboard([]).reply_markup
      );
      return;
    }

    logStep(ctx, "draft_confirm", tokenForTask, "step_final", callbackChatId, callbackMsgId);
    const ownerCanReassign =
      !!result.task.workspaceId &&
      (await deps.workspaceService.findWorkspaceById(result.task.workspaceId))?.ownerUserId === String(ctx.from.id);
    const replyMarkup = taskActionsKeyboard(
      {
        id: result.task.id,
        sourceText: result.task.sourceText,
        assigneeUserId: result.task.assigneeUserId,
        status: result.task.status
      },
      String(ctx.from.id),
      createSubmitNonce(),
      false,
      true,
      ownerCanReassign
    ).reply_markup;

    let assigneeDisplayName: string | undefined;
    if (result.task.workspaceId) {
      const assigneeMember = await deps.workspaceMemberService.findMember(
        result.task.workspaceId,
        result.task.assigneeUserId
      );
      if (assigneeMember) {
        assigneeDisplayName = memberDisplayName(assigneeMember);
      }
    }
    await updateOrReply(
      ctx,
      renderTaskCard(result.task, String(ctx.from.id), assigneeDisplayName),
      replyMarkup
    );
    await notifyAssigneeOnCreated(ctx, {
      id: result.task.id,
      sourceText: result.task.sourceText,
      creatorUserId: result.task.creatorUserId,
      assigneeUserId: result.task.assigneeUserId,
      priority: result.task.priority,
      deadlineAt: result.task.deadlineAt
    });
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

    const dmDraftTextResult = await deps.taskService.applyDmDraftText(String(ctx.from.id), text);
    if (dmDraftTextResult.status === "UPDATED" || dmDraftTextResult.status === "STALE_STEP") {
      const draft = dmDraftTextResult.draft;
      if (draft.step === "CHOOSE_ASSIGNEE") {
        const keyboard = await buildAssigneeKeyboardByWorkspace(
          deps,
          String(ctx.from.id),
          draft.token,
          draft.workspaceId
        );
        await ctx.reply(ru.startTask.chooseAssignee, keyboard as never);
        return;
      }
      if (draft.step === "CHOOSE_PRIORITY") {
        await ctx.reply(ru.wizard.choosePriority, priorityKeyboard(draft.token));
        return;
      }
      if (draft.step === "CHOOSE_DEADLINE") {
        await ctx.reply(ru.wizard.chooseDeadline, deadlineKeyboard(draft.token));
        return;
      }
      if (draft.step === "CONFIRM") {
        await ctx.reply(ru.wizard.confirmCreate, confirmKeyboard(draft.token));
        return;
      }
      return;
    }

    const result = await deps.taskService.setDraftDeadlineFromText(String(ctx.from.id), text);
    if (result.status === "NOT_FOUND") {
      return;
    }
    if (result.status === "INVALID_DATE") {
      await ctx.reply(ru.wizard.invalidDate);
      return;
    }

    await ctx.reply(ru.wizard.confirmCreate, confirmKeyboard(result.draft.token));
  });
}
