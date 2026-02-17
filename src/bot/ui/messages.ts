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
      : task.status === "ON_REVIEW"
        ? ru.status.onReview
        : task.status === "CLOSED"
          ? ru.status.closed
          : ru.status.unknown;
  const color = task.priority === "P1" ? "🔴" : task.priority === "P2" ? "🟠" : "🟡";
  const title = shortenText(task.sourceText, 40);
  return `${index + 1}) ${color} ${task.priority} • ${title}\n⏰ Срок: ${formatDueDate(task.deadlineAt)} • 📌 Статус: ${statusRu}`;
}

export function shortTaskTitle(value: string): string {
  return shortenText(value, 20);
}

function shortTaskId(value: string): string {
  return value.slice(0, 8);
}

export function renderTaskCard(task: {
  id: string;
  assigneeUserId: string;
  priority: string;
  deadlineAt: Date | null;
  status: string;
  sourceText: string;
  lastReturnComment?: string | null;
}, viewerUserId: string, assigneeDisplayName?: string, assigneeRemoved = false): string {
  const statusRu =
    task.status === "ACTIVE"
      ? ru.status.active
      : task.status === "ON_REVIEW"
        ? ru.status.onReview
        : task.status === "CLOSED"
          ? ru.status.closed
          : ru.status.unknown;

  const safeContext = shortenText(task.sourceText, 800);
  const returnComment = (task.lastReturnComment ?? "").trim();
  const assigneeLine =
    task.assigneeUserId === viewerUserId
      ? ru.taskCard.assigneeYou
      : ru.taskCard.assignee(assigneeDisplayName ?? task.assigneeUserId);

  const lines = [
    `${ru.taskCard.title} ${ru.taskCard.idShort(shortTaskId(task.id))}`,
    assigneeLine,
    ...(assigneeRemoved ? [ru.taskCard.assigneeRemovedWarning] : []),
    ru.taskCard.priority(task.priority),
    ru.taskCard.deadline(formatDueDate(task.deadlineAt)),
    ru.taskCard.status(statusRu),
    ...(returnComment ? [ru.taskCard.returnCommentTitle, returnComment] : []),
    ru.taskCard.text(safeContext)
  ];
  return lines.join("\n");
}
