import type { TaskService } from "../../../domain/tasks/task.service.js";

export async function handleStartTask(
  ctx: {
    from: { id: number };
    reply(text: string, extra?: unknown): Promise<unknown>;
  },
  taskService: TaskService,
  token: string,
  assigneeKeyboard: (token: string, sourceChatId: string) => Promise<unknown> | unknown
): Promise<void> {
  const started = await taskService.startDraftWizard(token, String(ctx.from.id));
  if (started.status === "NOT_FOUND") {
    await ctx.reply("Черновик не найден");
    return;
  }

  if (started.status === "ALREADY_EXISTS") {
    await ctx.reply(`Задача уже существует (id: ${started.task.id})`);
    return;
  }

  await ctx.reply("Choose assignee", await assigneeKeyboard(token, started.draft.sourceChatId));
}
