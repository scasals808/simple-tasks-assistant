import { Markup, type Telegraf } from "telegraf";

import type { TaskPriority } from "../../domain/tasks/task.types.js";
import type { BotDeps } from "../types.js";
import { confirmKeyboard, deadlineKeyboard, priorityKeyboard } from "../ui/keyboards.js";
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

async function buildAssigneeKeyboardByWorkspace(
  deps: BotDeps,
  fallbackUserId: string,
  tokenForTask: string,
  workspaceId: string | null
): Promise<unknown> {
  if (!workspaceId) {
    return Markup.inlineKeyboard([
      [Markup.button.callback(fallbackUserId, `draft_assignee:${tokenForTask}:${fallbackUserId}`)]
    ]);
  }
  const members = await deps.workspaceMemberService.listWorkspaceMembers(workspaceId);
  const rows = members.map((member) => [
    Markup.button.callback(
      `${member.userId} (${member.role})`,
      `draft_assignee:${tokenForTask}:${member.userId}`
    )
  ]);
  return Markup.inlineKeyboard(
    rows.length > 0
      ? rows
      : [[Markup.button.callback(fallbackUserId, `draft_assignee:${tokenForTask}:${fallbackUserId}`)]]
  );
}

export function registerDraftWizardRoutes(bot: Telegraf, deps: BotDeps): void {
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

    const result = await deps.taskService.setDraftPriority(tokenForTask, String(ctx.from.id), priority);
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

    const result = await deps.taskService.setDraftDeadlineChoice(tokenForTask, String(ctx.from.id), choice);
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

    const result = await deps.taskService.finalizeDraft(tokenForTask, String(ctx.from.id));
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
        await ctx.reply("Choose assignee", keyboard as never);
        return;
      }
      if (draft.step === "CHOOSE_PRIORITY") {
        await ctx.reply("Choose priority", priorityKeyboard(draft.token));
        return;
      }
      if (draft.step === "CHOOSE_DEADLINE") {
        await ctx.reply("Choose deadline", deadlineKeyboard(draft.token));
        return;
      }
      if (draft.step === "CONFIRM") {
        await ctx.reply("Confirm task creation", confirmKeyboard(draft.token));
        return;
      }
      return;
    }

    const result = await deps.taskService.setDraftDeadlineFromText(String(ctx.from.id), text);
    if (result.status === "NOT_FOUND") {
      return;
    }
    if (result.status === "INVALID_DATE") {
      await ctx.reply("Invalid date. Use YYYY-MM-DD");
      return;
    }

    await ctx.reply("Confirm task creation", confirmKeyboard(result.draft.token));
  });
}
