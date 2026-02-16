import { TaskService } from "../domain/tasks/task.service.js";
import type { Clock } from "../domain/ports/clock.port.js";
import { PendingDeletionRepoPrisma } from "../infra/db/pendingDeletion.repo.prisma.js";
import { PrismaTaskRepo } from "../infra/db/task.repo.prisma.js";

const clock: Clock = {
  now: () => new Date()
};

const taskRepo = new PrismaTaskRepo();
const pendingDeletionRepo = new PendingDeletionRepoPrisma();
const taskService = new TaskService(clock, taskRepo);

export const container = {
  clock,
  pendingDeletionRepo,
  taskRepo,
  taskService
};
