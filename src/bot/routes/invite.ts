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
import { ru } from "../texts/ru.js";
import { buildMainMenuRows } from "../ui/keyboards.js";
import { logMenuRender } from "./logging.js";

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

export function registerInviteRoutes(bot: Telegraf, deps: BotDeps): void {
  async function canSeeOnReviewButton(userId: number | undefined): Promise<boolean> {
    if (typeof userId !== "number") {
      return false;
    }
    const userIdText = String(userId);
    const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(userIdText);
    if (!workspaceId) {
      return false;
    }
    const workspace = await deps.workspaceService.findWorkspaceById(workspaceId);
    if (workspace?.ownerUserId === userIdText) {
      await deps.workspaceMemberService.upsertOwnerMembership(workspaceId, userIdText);
      return true;
    }
    const membership = await deps.workspaceMemberService.findMember(workspaceId, userIdText);
    return membership?.role === "OWNER";
  }

  bot.start(async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }

    const payload = extractStartPayload((ctx.message as { text?: string }).text);
    const parsed = parseStartPayload(payload);
    const route = selectStartRoute(parsed);
    if (route === "join" && parsed.type === "join") {
      await handleStartJoin(ctx, deps.workspaceInviteService, parsed.token);
      const rowsAfterJoin = buildMainMenuRows(
        ctx.from?.id,
        deps.adminUserIds,
        await canSeeOnReviewButton(ctx.from?.id)
      );
      await ctx.reply("Меню", Markup.keyboard(rowsAfterJoin).resize());
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
            renderMemberDisplayName(member),
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
    const workspaceId = await deps.workspaceMemberService.findLatestWorkspaceIdForUser(String(ctx.from.id));
    if (!workspaceId) {
      await ctx.reply(ru.menu.onboardingNoMembership);
      return;
    }
    await deps.workspaceMemberService.touchLatestMembershipProfile(String(ctx.from.id), {
      tgFirstName: ctx.from.first_name ?? null,
      tgLastName: ctx.from.last_name ?? null,
      tgUsername: ctx.from.username ?? null
    });

    const rows = buildMainMenuRows(
      ctx.from?.id,
      deps.adminUserIds,
      await canSeeOnReviewButton(ctx.from?.id)
    );
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
