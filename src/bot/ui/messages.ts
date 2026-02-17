export function formatDueDate(value: Date | null): string {
  if (!value) {
    return "-";
  }
  return value.toISOString().slice(0, 10);
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
  id: string;
  priority: string;
  deadlineAt: Date | null;
  sourceText: string;
  status: string;
}): string {
  return `[${task.priority}] due ${formatDueDate(task.deadlineAt)} ${shortenText(task.sourceText)} ${task.status} (${task.id})`;
}
