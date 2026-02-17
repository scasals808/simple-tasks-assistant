import { Markup, type Telegraf } from "telegraf";

import { isAdmin } from "../../config/env.js";
import { handleStartJoin } from "../start/handlers/start.join.js";
import { handleStartPlain } from "../start/handlers/start.plain.js";
import { handleStartTask } from "../start/handlers/start.task.js";
import {
  extractStartPayload,
  parseStartPayload,
  selectStartRoute
} from "../start/start.router.js";
import type { BotDeps } from "../types.js";
import { buildMainMenuRows } from "../ui/keyboards.js";
import { logMenuRender } from "./logging.js";

export function registerInviteRoutes(bot: Telegraf, deps: BotDeps): void {
  bot.start(async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    const payload = extractStartPayload((ctx.message as { text?: string }).text);
    const parsed = parseStartPayload(payload);
    const route = selectStartRoute(parsed);
    if (route === "join" && parsed.type === "join") {
      await handleStartJoin(ctx, deps.workspaceInviteService, parsed.token);
      return;
    }
    if (route === "task" && parsed.type === "task") {
      await handleStartTask(ctx, deps.taskService, parsed.token, async (draftToken, sourceChatId) => {
        const workspace = await deps.workspaceService.findWorkspaceByChatId(sourceChatId);
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
        const members = await deps.workspaceMemberService.listWorkspaceMembers(workspace.id);
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
    const rows = buildMainMenuRows(ctx.from?.id, deps.adminUserIds);
    const count = rows.reduce((acc, row) => acc + row.length, 0);
    logMenuRender({
      userId: ctx.from?.id,
      isAdminUser: typeof ctx.from?.id === "number" && isAdmin(ctx.from.id, deps.adminUserIds),
      buttonsRenderedCount: count
    });
    await handleStartPlain(
      ctx,
      Markup.keyboard(rows).resize()
    );
  });
}
