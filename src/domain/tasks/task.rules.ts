import type { Task, TaskPriority } from "./task.types.js";

export function priorityRank(priority: TaskPriority): number {
  if (priority === "P1") return 1;
  if (priority === "P2") return 2;
  return 3;
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const priorityDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (priorityDiff !== 0) return priorityDiff;

    if (a.deadlineAt && b.deadlineAt) {
      const deadlineDiff = a.deadlineAt.getTime() - b.deadlineAt.getTime();
      if (deadlineDiff !== 0) return deadlineDiff;
    } else if (a.deadlineAt && !b.deadlineAt) {
      return -1;
    } else if (!a.deadlineAt && b.deadlineAt) {
      return 1;
    }

    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}
