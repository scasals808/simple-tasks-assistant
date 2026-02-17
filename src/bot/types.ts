import type { Telegraf } from "telegraf";

import type { TaskService } from "../domain/tasks/task.service.js";
import type { WorkspaceAdminService } from "../domain/workspaces/workspace-admin.service.js";
import type { WorkspaceInviteService } from "../domain/workspaces/workspace-invite.service.js";
import type { WorkspaceMemberService } from "../domain/workspaces/workspace-member.service.js";
import type { WorkspaceService } from "../domain/workspaces/workspace.service.js";

export type BotDeps = {
  taskService: TaskService;
  workspaceService: WorkspaceService;
  workspaceMemberService: WorkspaceMemberService;
  workspaceInviteService: WorkspaceInviteService;
  workspaceAdminService: WorkspaceAdminService;
  botUsername: string;
  adminUserIds: Set<string>;
  allowAdminReset: boolean;
};

export type BotRouteRegistrar = (bot: Telegraf, deps: BotDeps) => void;
