import { TaskService } from "../domain/tasks/task.service.js";
import type { Clock } from "../domain/ports/clock.port.js";
import { PrismaTaskRepo } from "../infra/db/task.repo.prisma.js";
import { WorkspaceService } from "../domain/workspaces/workspace.service.js";
import { WorkspaceRepoPrisma } from "../infra/db/workspace.repo.prisma.js";
import { WorkspaceMemberService } from "../domain/workspaces/workspace-member.service.js";
import { WorkspaceMemberRepoPrisma } from "../infra/db/workspace-member.repo.prisma.js";
import { WorkspaceInviteRepoPrisma } from "../infra/db/workspace-invite.repo.prisma.js";
import { WorkspaceInviteService } from "../domain/workspaces/workspace-invite.service.js";
import { WorkspaceAdminService } from "../domain/workspaces/workspace-admin.service.js";

const clock: Clock = {
  now: () => new Date()
};

const taskRepo = new PrismaTaskRepo();
const workspaceRepo = new WorkspaceRepoPrisma();
const workspaceMemberRepo = new WorkspaceMemberRepoPrisma();
const workspaceInviteRepo = new WorkspaceInviteRepoPrisma();
const taskService = new TaskService(clock, taskRepo);
const workspaceService = new WorkspaceService(workspaceRepo);
const workspaceMemberService = new WorkspaceMemberService(clock, workspaceMemberRepo);
const workspaceInviteService = new WorkspaceInviteService(
  clock,
  workspaceInviteRepo,
  workspaceRepo,
  workspaceMemberRepo
);
const workspaceAdminService = new WorkspaceAdminService(
  workspaceRepo,
  workspaceInviteRepo
);

export const container = {
  clock,
  workspaceAdminService,
  workspaceInviteRepo,
  workspaceInviteService,
  workspaceMemberRepo,
  workspaceMemberService,
  workspaceRepo,
  workspaceService,
  taskRepo,
  taskService
};
