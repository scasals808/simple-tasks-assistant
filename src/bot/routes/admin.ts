import { type Telegraf } from "telegraf";

import { isAdmin } from "../../config/env.js";
import type { BotDeps } from "../types.js";
import { adminMenuKeyboard } from "../ui/keyboards.js";
import {
  logAdminAction,
  logAdminCreateTeam,
  logAdminCreateTeamReject,
  logAdminReset
} from "./logging.js";

export function registerAdminRoutes(bot: Telegraf, deps: BotDeps): void {
  bot.command("admin", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    if (!isAdmin(String(ctx.from.id), deps.adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    await ctx.reply("Admin menu", adminMenuKeyboard());
  });

  bot.command("admin_create_team", async (ctx) => {
    if (ctx.chat.type !== "private") {
      return;
    }
    if (!isAdmin(String(ctx.from.id), deps.adminUserIds)) {
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
      const result = await deps.workspaceService.ensureWorkspaceForChatWithResult(chatId, title);
      if (result.result === "created") {
        await deps.workspaceAdminService.setOwner(result.workspace.id, String(ctx.from.id), false);
        await deps.workspaceMemberService.upsertOwnerMembership(result.workspace.id, String(ctx.from.id));
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
    if (!isAdmin(String(ctx.from.id), deps.adminUserIds)) {
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
      const ownerCheck = await deps.workspaceAdminService.isOwner(workspaceId, String(ctx.from.id));
      console.log("[bot.permission_check]", {
        handler: replace ? "admin_replace_owner" : "admin_set_owner",
        user_id: ctx.from.id,
        workspaceId,
        is_owner: ownerCheck
      });
      const result = await deps.workspaceAdminService.setOwner(workspaceId, userId, replace);
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
    if (!isAdmin(String(ctx.from.id), deps.adminUserIds)) {
      await ctx.reply("forbidden");
      return;
    }
    const text = (ctx.message as { text?: string }).text ?? "";
    const parts = text.trim().split(/\s+/);
    const confirmed = parts[1] === phrase;
    if (!deps.allowAdminReset) {
      logAdminReset({
        adminUserId: ctx.from.id,
        chatId: ctx.chat.id,
        enabled: deps.allowAdminReset,
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
        enabled: deps.allowAdminReset,
        confirmed,
        errorCode: "CONFIRMATION_MISMATCH",
        errorDescription: "invalid confirmation phrase"
      });
      await ctx.reply("Send: /admin_reset CONFIRM_DELETE_ALL_TEST_DATA");
      return;
    }
    try {
      const deletedCounts = await deps.workspaceAdminService.resetAllWorkspaceData();
      logAdminReset({
        adminUserId: ctx.from.id,
        chatId: ctx.chat.id,
        enabled: deps.allowAdminReset,
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
        enabled: deps.allowAdminReset,
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
    if (!isAdmin(String(ctx.from.id), deps.adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    await ctx.reply("Admin menu", adminMenuKeyboard());
  });

  bot.action(/^admin_create_team$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(String(ctx.from.id), deps.adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    await ctx.reply("Send: /admin_create_team <chatId> [title...]");
  });

  bot.action(/^admin_generate_invite$/, async (ctx) => {
    await ctx.answerCbQuery();
    if (!isAdmin(String(ctx.from.id), deps.adminUserIds)) {
      await ctx.reply("Forbidden");
      return;
    }
    try {
      const invite = await deps.workspaceAdminService.createInviteForLatest(null);
      await ctx.reply(`Invite link: https://t.me/${deps.botUsername}?start=join_${invite.token}`);
    } catch {
      await ctx.reply("No workspace found");
    }
  });
}
