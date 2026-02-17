import { ru } from "../texts/ru.js";

export function formatDueDate(value: Date | null): string {
  if (!value) {
    return ru.taskList.dueNone;
  }
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = String(value.getFullYear());
  return `${day}.${month}.${year}`;
}

export function shortenText(value: string, max = 24): string {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) {
    return "-";
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

export function renderTaskListHeader(kind: "assigned" | "created", count: number): string {
  return kind === "assigned" ? `📥 Мне назначено (${count})` : `✍️ Я создал (${count})`;
}

export function renderTaskLine(task: {
  priority: string;
  deadlineAt: Date | null;
  sourceText: string;
  status: string;
}, index: number): string {
  const statusRu =
    task.status === "ACTIVE"
      ? ru.status.active
      : task.status === "DONE"
        ? ru.status.done
        : task.status === "ARCHIVED"
          ? ru.status.archived
          : ru.status.unknown;
  const color = task.priority === "P1" ? "🔴" : task.priority === "P2" ? "🟠" : "🟡";
  const title = shortenText(task.sourceText, 40);
  return `${index + 1}) ${color} ${task.priority} • ${title}\n⏰ Срок: ${formatDueDate(task.deadlineAt)} • 📌 Статус: ${statusRu}`;
}

export function shortTaskTitle(value: string): string {
  return shortenText(value, 20);
}
