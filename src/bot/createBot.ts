import { Telegraf } from "telegraf";

import type { TaskService } from "../domain/tasks/task.service.js";
import type { WorkspaceAdminService } from "../domain/workspaces/workspace-admin.service.js";
import type { WorkspaceInviteService } from "../domain/workspaces/workspace-invite.service.js";
import type { WorkspaceMemberService } from "../domain/workspaces/workspace-member.service.js";
import type { WorkspaceService } from "../domain/workspaces/workspace.service.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerDraftWizardRoutes } from "./routes/draftWizard.js";
import { registerInviteRoutes } from "./routes/invite.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import type { BotDeps } from "./types.js";

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
  const gcLimit = 50;
  const deps: BotDeps = {
    taskService,
    workspaceService,
    workspaceMemberService,
    workspaceInviteService,
    workspaceAdminService,
    botUsername,
    adminUserIds,
    allowAdminReset
  };

  bot.use(async (ctx, next) => {
    const userId = typeof ctx.from?.id === "number" ? String(ctx.from.id) : null;
    if (userId) {
      void (async () => {
        let workspaceId: string | null = null;
        try {
          workspaceId = await workspaceMemberService.resolveCurrentWorkspaceId(userId);
          if (!workspaceId) {
            return;
          }
          console.log("[gc] start", { workspaceId, limit: gcLimit });
          const deleted = await taskService.garbageCollectClosedTasks(workspaceId, gcLimit);
          console.log("[gc] deleted", { workspaceId, count: deleted });
        } catch (error: unknown) {
          console.error("[gc] error", {
            workspaceId,
            err: error instanceof Error ? error.message : String(error)
          });
        }
      })();
    }
    return next();
  });

  registerInviteRoutes(bot, deps);
  registerTaskRoutes(bot, deps);
  registerAdminRoutes(bot, deps);
  registerDraftWizardRoutes(bot, deps);
  console.log("[bot] routes registered");

  return bot;
}
