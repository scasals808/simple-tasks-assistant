import { describe, expect, it, vi } from "vitest";

type Handler = (ctx: Record<string, unknown>) => Promise<unknown> | unknown;
type MockBot = {
  commandHandlers: Map<string, Handler>;
  actionHandlers: Array<{ pattern: RegExp; handler: Handler }>;
};

const telegrafMock = vi.hoisted(() => {
  class TelegrafMock {
    commandHandlers = new Map<string, Handler>();
    actionHandlers: Array<{ pattern: RegExp; handler: Handler }> = [];
    hearsHandlers: Array<{ triggers: string[]; handler: Handler }> = [];
    startHandler: Handler | null = null;
    onHandlers: Array<{ event: string; handler: Handler }> = [];

    start(handler: Handler): this {
      this.startHandler = handler;
      return this;
    }

    hears(triggers: string[] | string, handler: Handler): this {
      this.hearsHandlers.push({ triggers: Array.isArray(triggers) ? triggers : [triggers], handler });
      return this;
    }

    command(command: string, handler: Handler): this {
      this.commandHandlers.set(command, handler);
      return this;
    }

    action(pattern: RegExp, handler: Handler): this {
      this.actionHandlers.push({ pattern, handler });
      return this;
    }

    on(event: string, handler: Handler): this {
      this.onHandlers.push({ event, handler });
      return this;
    }
  }

  return { TelegrafMock };
});

vi.mock("telegraf", () => ({
  Telegraf: telegrafMock.TelegrafMock,
  Markup: {
    button: {
      callback: (text: string, callback_data: string) => ({ text, callback_data })
    },
    inlineKeyboard: (inline_keyboard: unknown) => ({ reply_markup: { inline_keyboard } }),
    keyboard: (keyboard: unknown) => ({
      resize: () => ({ reply_markup: { keyboard } })
    })
  }
}));

import { createBot } from "../src/bot/index.js";

describe("bot admin handlers", () => {
  it("blocks non-admin in /admin", async () => {
    const reply = vi.fn(async () => undefined);
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceAdminService = {
      createWorkspaceManual: vi.fn(async () => ({ id: "ws-1", title: "T" })),
      createInviteForLatest: vi.fn(async () => ({ token: "tok", workspaceId: "ws-1" })),
      setAssignerForLatest: vi.fn(async () => ({ id: "ws-1", assignerUserId: "1" }))
    } as never;

    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      workspaceInviteService,
      workspaceAdminService,
      ["1"]
    ) as unknown as MockBot;

    const handler = bot.commandHandlers.get("admin");
    expect(handler).toBeDefined();
    await handler?.({
      chat: { type: "private" },
      from: { id: 2 },
      reply
    });

    expect(reply).toHaveBeenCalledWith("Forbidden");
  });

  it("admin can generate invite link", async () => {
    const answerCbQuery = vi.fn(async () => undefined);
    const reply = vi.fn(async () => undefined);
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceAdminService = {
      createWorkspaceManual: vi.fn(async () => ({ id: "ws-1", title: "T" })),
      createInviteForLatest: vi.fn(async () => ({ token: "tok123", workspaceId: "ws-1" })),
      setAssignerForLatest: vi.fn(async () => ({ id: "ws-1", assignerUserId: "1" }))
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      workspaceInviteService,
      workspaceAdminService,
      ["1"]
    ) as unknown as MockBot;

    const action = bot.actionHandlers.find((item) => item.pattern.test("admin_generate_invite"));
    expect(action).toBeDefined();
    await action?.handler({
      from: { id: 1 },
      answerCbQuery,
      reply
    });

    expect(answerCbQuery).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith("Invite link: https://t.me/my_bot?start=join_tok123");
  });
});
