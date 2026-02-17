import { Markup } from "telegraf";

import { isAdmin } from "../../config/env.js";

export function priorityKeyboard(token: string) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("P1", `draft_priority:${token}:P1`),
      Markup.button.callback("P2", `draft_priority:${token}:P2`),
      Markup.button.callback("P3", `draft_priority:${token}:P3`)
    ]
  ]);
}

export function deadlineKeyboard(token: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Today", `draft_deadline:${token}:today`)],
    [Markup.button.callback("Tomorrow", `draft_deadline:${token}:tomorrow`)],
    [Markup.button.callback("No deadline", `draft_deadline:${token}:none`)],
    [Markup.button.callback("Enter date (YYYY-MM-DD)", `draft_deadline:${token}:manual`)]
  ]);
}

export function confirmKeyboard(token: string) {
  return Markup.inlineKeyboard([[Markup.button.callback("Create", `draft_confirm:${token}`)]]);
}

export function adminMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("Create team", "admin_create_team")],
    [Markup.button.callback("Generate invite link", "admin_generate_invite")]
  ]);
}

export function buildMainMenuRows(
  userId: number | undefined,
  adminUserIds: Set<string>
): string[][] {
  const isAdminUser = typeof userId === "number" && isAdmin(userId, adminUserIds);
  const rows: string[][] = [["📥 Мне назначено", "✍️ Я создал"], ["➕ Новая задача", "ℹ️ Помощь"]];
  if (isAdminUser) {
    rows.push(["Admin"]);
  }
  return rows;
}

export function buildSourceLink(
  chatId: number,
  chatUsername: string | undefined,
  messageId: number
): string | null {
  if (chatUsername) {
    return `https://t.me/${chatUsername}/${messageId}`;
  }

  const raw = String(chatId);
  if (raw.startsWith("-100")) {
    return `https://t.me/c/${raw.slice(4)}/${messageId}`;
  }

  return null;
}
