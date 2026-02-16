import { TaskService } from "../domain/tasks/task.service.js";
import type { Clock } from "../domain/ports/clock.port.js";
import { PrismaTaskRepo } from "../infra/db/task.repo.prisma.js";

const clock: Clock = {
  now: () => new Date()
};

const taskRepo = new PrismaTaskRepo();
const taskService = new TaskService(clock, taskRepo);

export const container = {
  clock,
  taskRepo,
  taskService
};
