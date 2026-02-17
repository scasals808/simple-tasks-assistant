import { describe, expect, it, vi } from "vitest";

import { handleStartJoin } from "../src/bot/start/handlers/start.join.js";
import { handleStartPlain } from "../src/bot/start/handlers/start.plain.js";
import { handleStartTask } from "../src/bot/start/handlers/start.task.js";

describe("start handlers", () => {
  it("handleStartJoin replies with joined team title", async () => {
    const reply = vi.fn(async () => undefined);
    const ctx = {
      from: { id: 42 },
      update: { update_id: 1001 },
      reply
    };
    const workspaceInviteService = {
      acceptInvite: vi.fn(async () => ({
        workspace: {
          id: "ws-1",
          title: "Alpha Team"
        }
      }))
    };

    await handleStartJoin(
      ctx,
      workspaceInviteService as unknown as {
        acceptInvite(token: string, userId: string): Promise<{ workspace: { id: string; title: string | null } }>;
      },
      "token-1"
    );

    expect(workspaceInviteService.acceptInvite).toHaveBeenCalledWith("token-1", "42");
    expect(reply).toHaveBeenCalledWith("Вы в команде: Alpha Team");
  });

  it("handleStartJoin logs and replies on invite error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const reply = vi.fn(async () => undefined);
    const ctx = {
      from: { id: 42 },
      update: { update_id: 1002 },
      reply
    };
    const workspaceInviteService = {
      acceptInvite: vi.fn(async () => {
        throw new Error("Invite is invalid or expired");
      })
    };

    await handleStartJoin(
      ctx,
      workspaceInviteService as unknown as {
        acceptInvite(token: string, userId: string): Promise<{ workspace: { id: string; title: string | null } }>;
      },
      "token-2"
    );

    expect(reply).toHaveBeenCalledWith("Ссылка-приглашение недействительна или истекла.");
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("handleStartTask replies draft not found", async () => {
    const reply = vi.fn(async () => undefined);
    const ctx = { from: { id: 7 }, reply };
    const taskService = {
      startDraftWizard: vi.fn(async () => ({ status: "NOT_FOUND" as const }))
    };

    await handleStartTask(
      ctx,
      taskService as unknown as {
        startDraftWizard(token: string, userId: string): Promise<{ status: "NOT_FOUND" }>;
      },
      "task-token",
      () => ({})
    );

    expect(reply).toHaveBeenCalledWith("Черновик не найден.");
  });

  it("handleStartTask replies already exists", async () => {
    const reply = vi.fn(async () => undefined);
    const ctx = { from: { id: 8 }, reply };
    const taskService = {
      startDraftWizard: vi.fn(async () => ({
        status: "ALREADY_EXISTS" as const,
        task: { id: "task-1" }
      }))
    };

    await handleStartTask(
      ctx,
      taskService as unknown as {
        startDraftWizard(
          token: string,
          userId: string
        ): Promise<{ status: "ALREADY_EXISTS"; task: { id: string } }>;
      },
      "task-token",
      () => ({})
    );

    expect(reply).toHaveBeenCalledWith("Задача уже существует (id: task-1).");
  });

  it("handleStartTask starts assignee step", async () => {
    const reply = vi.fn(async () => undefined);
    const ctx = { from: { id: 9 }, reply };
    const taskService = {
      startDraftWizard: vi.fn(async () => ({
        status: "STARTED" as const,
        draft: { id: "d-1", sourceChatId: "-1001" }
      }))
    };
    const keyboard = { reply_markup: { inline_keyboard: [] } };
    const assigneeKeyboard = vi.fn(async () => keyboard);

    await handleStartTask(
      ctx,
      taskService as unknown as {
        startDraftWizard(
          token: string,
          userId: string
        ): Promise<{ status: "STARTED"; draft: { id: string; sourceChatId: string } }>;
      },
      "task-token",
      assigneeKeyboard
    );

    expect(assigneeKeyboard).toHaveBeenCalledWith("task-token", "-1001");
    expect(reply).toHaveBeenCalledWith("Выберите исполнителя.", keyboard);
  });

  it("handleStartPlain sends welcome text", async () => {
    const reply = vi.fn(async () => undefined);
    const ctx = { reply };
    const keyboard = { reply_markup: { keyboard: [] } };

    await handleStartPlain(ctx, keyboard);

    expect(reply).toHaveBeenCalledWith(
      "Привет! Я помогу быстро создавать задачи из сообщений.",
      keyboard
    );
  });
});
