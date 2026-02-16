import { TaskService } from "../domain/tasks/task.service.js";
import type { Clock } from "../domain/ports/clock.port.js";
import { PrismaTaskRepo } from "../infra/db/task.repo.prisma.js";
import { WorkspaceService } from "../domain/workspaces/workspace.service.js";
import { WorkspaceRepoPrisma } from "../infra/db/workspace.repo.prisma.js";
import { WorkspaceMemberService } from "../domain/workspaces/workspace-member.service.js";
import { WorkspaceMemberRepoPrisma } from "../infra/db/workspace-member.repo.prisma.js";

const clock: Clock = {
  now: () => new Date()
};

const taskRepo = new PrismaTaskRepo();
const workspaceRepo = new WorkspaceRepoPrisma();
const workspaceMemberRepo = new WorkspaceMemberRepoPrisma();
const taskService = new TaskService(clock, taskRepo);
const workspaceService = new WorkspaceService(workspaceRepo);
const workspaceMemberService = new WorkspaceMemberService(clock, workspaceMemberRepo);

export const container = {
  clock,
  workspaceMemberRepo,
  workspaceMemberService,
  workspaceRepo,
  workspaceService,
  taskRepo,
  taskService
};
