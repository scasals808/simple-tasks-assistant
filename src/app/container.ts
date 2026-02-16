import { TaskService } from "../domain/tasks/task.service.js";
import type { Clock } from "../domain/ports/clock.port.js";
import { PrismaTaskRepo } from "../infra/db/task.repo.prisma.js";
import { WorkspaceService } from "../domain/workspaces/workspace.service.js";
import { WorkspaceRepoPrisma } from "../infra/db/workspace.repo.prisma.js";

const clock: Clock = {
  now: () => new Date()
};

const taskRepo = new PrismaTaskRepo();
const workspaceRepo = new WorkspaceRepoPrisma();
const taskService = new TaskService(clock, taskRepo);
const workspaceService = new WorkspaceService(workspaceRepo);

export const container = {
  clock,
  workspaceRepo,
  workspaceService,
  taskRepo,
  taskService
};
