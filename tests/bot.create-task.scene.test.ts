import { describe, expect, it, vi } from "vitest";

import { createTaskWizardScene } from "../src/bot/scenes/createTask.scene.js";
import type { TaskService } from "../src/domain/tasks/task.service.js";

type SceneStep = (ctx: unknown, next: () => Promise<void>) => Promise<unknown>;

type MockCtx = {
  scene: {
    state: unknown;
    leave: ReturnType<typeof vi.fn>;
  };
  wizard: {
    state: Record<string, unknown>;
    next: ReturnType<typeof vi.fn>;
  };
  from?: { id: number };
  callbackQuery?: { data?: string };
  reply: ReturnType<typeof vi.fn>;
  answerCbQuery: ReturnType<typeof vi.fn>;
};

function getSteps(scene: unknown): SceneStep[] {
  return (scene as { steps: SceneStep[] }).steps;
}

function createBaseCtx(): MockCtx {
  return {
    scene: {
      state: {},
      leave: vi.fn(async () => undefined)
    },
    wizard: {
      state: {},
      next: vi.fn(async () => undefined)
    },
    reply: vi.fn(async () => undefined),
    answerCbQuery: vi.fn(async () => undefined)
  };
}

describe("createTaskWizardScene", () => {
  it("leaves scene when token is missing", async () => {
    const taskService = {
      createTask: vi.fn(async () => {
        throw new Error("should not be called");
      })
    } as unknown as TaskService;
    const pending = new Map();
    const scene = createTaskWizardScene(taskService, pending);
    const [step1] = getSteps(scene);

    const ctx = createBaseCtx();
    ctx.from = { id: 1 };

    await step1(ctx, async () => undefined);

    expect(ctx.reply).toHaveBeenCalledWith("Не удалось начать создание задачи");
    expect(ctx.scene.leave).toHaveBeenCalledTimes(1);
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  it("creates task through all wizard steps", async () => {
    const createTask = vi.fn(async () => ({
      id: "generated",
      sourceChatId: "chat-1",
      sourceMessageId: "10",
      sourceText: "text",
      sourceLink: null,
      creatorUserId: "42",
      assigneeUserId: "maria",
      priority: "P1",
      deadlineAt: null,
      status: "ACTIVE",
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    const taskService = {
      createTask
    } as unknown as TaskService;

    const token = "tok-1";
    const pending = new Map([
      [
        token,
        {
          sourceChatId: "chat-1",
          sourceMessageId: "10",
          sourceText: "text",
          sourceLink: null,
          creatorUserId: "42"
        }
      ]
    ]);

    const scene = createTaskWizardScene(taskService, pending);
    const [step1, step2, step3, step4] = getSteps(scene);

    const ctx = createBaseCtx();
    ctx.scene.state = { token };
    ctx.from = { id: 42 };

    await step1(ctx, async () => undefined);
    ctx.callbackQuery = { data: "wizard_assignee:maria" };
    await step2(ctx, async () => undefined);
    ctx.callbackQuery = { data: "wizard_priority:P1" };
    await step3(ctx, async () => undefined);
    ctx.callbackQuery = { data: "wizard_deadline:none" };
    await step4(ctx, async () => undefined);

    expect(createTask).toHaveBeenCalledTimes(1);
    expect(createTask.mock.calls[0][0]).toMatchObject({
      sourceChatId: "chat-1",
      sourceMessageId: "10",
      sourceText: "text",
      creatorUserId: "42",
      assigneeUserId: "maria",
      priority: "P1",
      deadlineAt: null
    });
    expect(ctx.reply).toHaveBeenLastCalledWith("Задача создана");
    expect(ctx.scene.leave).toHaveBeenCalled();
    expect(pending.has(token)).toBe(false);
  });
});
