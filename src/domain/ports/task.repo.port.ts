import type { Task } from "../tasks/task.types.js";

export interface TaskRepo {
  create(task: Task): Promise<Task>;
}
