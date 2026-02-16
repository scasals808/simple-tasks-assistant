import { Markup, Scenes } from "telegraf";

import type { TaskService } from "../../domain/tasks/task.service.js";
import type { TaskPriority } from "../../domain/tasks/task.types.js";

type PendingTaskSource = {
  sourceChatId: string;
  sourceMessageId: string;
  sourceText: string;
  sourceLink: string | null;
  creatorUserId: string;
};

export type CreateTaskSessionState = {
  token?: string;
  assigneeUserId?: string;
  priority?: TaskPriority;
  deadlineAt?: Date | null;
};

type BotSession = Scenes.WizardSessionData & {
  _unused?: never;
};

export type BotContext = Scenes.WizardContext<BotSession>;

const assignees = [
  { id: "ivan", label: "Ivan" },
  { id: "maria", label: "Maria" },
  { id: "sergey", label: "Sergey" }
];

export function getDeadlineFromChoice(choice: string): Date | null {
  const now = new Date();
  if (choice === "today") {
    const date = new Date(now);
    date.setHours(23, 59, 59, 999);
    return date;
  }
  if (choice === "tomorrow") {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(23, 59, 59, 999);
    return date;
  }
  return null;
}

export function createTaskWizardScene(
  taskService: TaskService,
  pendingByToken: Map<string, PendingTaskSource>
): Scenes.WizardScene<BotContext> {
  return new Scenes.WizardScene<BotContext>(
    "create-task",
    async (ctx) => {
      const token = (ctx.scene.state as { token?: string }).token;
      const fromId = String(ctx.from?.id ?? "");
      console.log("[create-task] enter", { token, fromId });

      if (!token || !fromId) {
        await ctx.reply("Не удалось начать создание задачи");
        return ctx.scene.leave();
      }

      const pending = pendingByToken.get(token);
      if (!pending || pending.creatorUserId !== fromId) {
        await ctx.reply("Исходное сообщение не найдено");
        return ctx.scene.leave();
      }

      const state = ctx.wizard.state as CreateTaskSessionState;
      state.token = token;

      await ctx.reply(
        "Выберите исполнителя",
        Markup.inlineKeyboard(
          assignees.map((assignee) =>
            Markup.button.callback(assignee.label, `wizard_assignee:${assignee.id}`)
          )
        )
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      console.log("[create-task] step-assignee");
      if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
        return;
      }
      const data = ctx.callbackQuery.data;
      if (!data.startsWith("wizard_assignee:")) {
        return;
      }

      const state = ctx.wizard.state as CreateTaskSessionState;
      state.assigneeUserId = data.replace("wizard_assignee:", "");
      await ctx.answerCbQuery();
      await ctx.reply(
        "Выберите приоритет",
        Markup.inlineKeyboard([
          [
            Markup.button.callback("P1", "wizard_priority:P1"),
            Markup.button.callback("P2", "wizard_priority:P2"),
            Markup.button.callback("P3", "wizard_priority:P3")
          ]
        ])
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      console.log("[create-task] step-priority");
      if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
        return;
      }
      const data = ctx.callbackQuery.data;
      if (!data.startsWith("wizard_priority:")) {
        return;
      }

      const state = ctx.wizard.state as CreateTaskSessionState;
      state.priority = data.replace("wizard_priority:", "") as TaskPriority;
      await ctx.answerCbQuery();
      await ctx.reply(
        "Выберите срок",
        Markup.inlineKeyboard([
          [Markup.button.callback("Сегодня", "wizard_deadline:today")],
          [Markup.button.callback("Завтра", "wizard_deadline:tomorrow")],
          [Markup.button.callback("Без срока", "wizard_deadline:none")]
        ])
      );
      return ctx.wizard.next();
    },
    async (ctx) => {
      console.log("[create-task] step-deadline:before");
      if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
        return;
      }
      const data = ctx.callbackQuery.data;
      if (!data.startsWith("wizard_deadline:")) {
        return;
      }

      const state = ctx.wizard.state as CreateTaskSessionState;
      if (!state?.token || !state.assigneeUserId || !state.priority || !ctx.from) {
        await ctx.reply("Не удалось создать задачу");
        return ctx.scene.leave();
      }

      const pending = pendingByToken.get(state.token);
      if (!pending) {
        await ctx.reply("Исходное сообщение не найдено");
        return ctx.scene.leave();
      }

      const deadlineChoice = data.replace("wizard_deadline:", "");
      const deadlineAt = getDeadlineFromChoice(deadlineChoice);
      await ctx.answerCbQuery();

      try {
        await taskService.createTask({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          sourceChatId: pending.sourceChatId,
          sourceMessageId: pending.sourceMessageId,
          sourceText: pending.sourceText,
          sourceLink: pending.sourceLink,
          creatorUserId: pending.creatorUserId,
          assigneeUserId: state.assigneeUserId,
          priority: state.priority,
          deadlineAt
        });
      } catch (error: unknown) {
        console.error("[create-task] step-deadline:error", error);
        await ctx.reply("Не удалось создать задачу");
        return ctx.scene.leave();
      }

      pendingByToken.delete(state.token);
      console.log("[create-task] step-deadline:after");
      await ctx.reply("Задача создана");
      return ctx.scene.leave();
    }
  );
}
