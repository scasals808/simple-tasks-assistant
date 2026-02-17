import type { TaskService } from "../../../domain/tasks/task.service.js";
import { ru } from "../../texts/ru.js";

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
    await ctx.reply(ru.startTask.draftNotFound);
    return;
  }

  if (started.status === "ALREADY_EXISTS") {
    await ctx.reply(ru.startTask.alreadyExists(started.task.id));
    return;
  }

  await ctx.reply(ru.startTask.chooseAssignee, await assigneeKeyboard(token, started.draft.sourceChatId));
}
