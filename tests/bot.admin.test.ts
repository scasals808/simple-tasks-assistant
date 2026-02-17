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
    middlewares: Handler[] = [];

    start(handler: Handler): this {
      this.startHandler = handler;
      return this;
    }

    use(handler: Handler): this {
      this.middlewares.push(handler);
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
      setOwnerForLatest: vi.fn(async () => ({ id: "ws-1", ownerUserId: "1" })),
      setOwner: vi.fn(async () => ({ id: "ws-1", ownerUserId: "1" })),
      isOwner: vi.fn(async () => false),
      getLatestWorkspaceId: vi.fn(async () => "ws-1"),
      resetAllWorkspaceData: vi.fn(async () => ({
        workspaceMembers: 0,
        workspaceInvites: 0,
        workspaces: 0
      }))
    } as never;

    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      {} as never,
      {} as never,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      false
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
      setOwnerForLatest: vi.fn(async () => ({ id: "ws-1", ownerUserId: "1" })),
      setOwner: vi.fn(async () => ({ id: "ws-1", ownerUserId: "1" })),
      isOwner: vi.fn(async () => false),
      getLatestWorkspaceId: vi.fn(async () => "ws-1"),
      resetAllWorkspaceData: vi.fn(async () => ({
        workspaceMembers: 0,
        workspaceInvites: 0,
        workspaces: 0
      }))
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      {} as never,
      {} as never,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      false
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

  it("parses /admin_set_owner command and calls domain with explicit ids", async () => {
    const reply = vi.fn(async () => undefined);
    const setOwner = vi.fn(async () => ({ id: "ws-1", ownerUserId: "42" }));
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceAdminService = {
      createWorkspaceManual: vi.fn(async () => ({ id: "ws-1", title: "T" })),
      createInviteForLatest: vi.fn(async () => ({ token: "tok123", workspaceId: "ws-1" })),
      setOwnerForLatest: vi.fn(async () => ({ id: "ws-1", ownerUserId: "1" })),
      setOwner,
      isOwner: vi.fn(async () => false),
      getLatestWorkspaceId: vi.fn(async () => "ws-1"),
      resetAllWorkspaceData: vi.fn(async () => ({
        workspaceMembers: 0,
        workspaceInvites: 0,
        workspaces: 0
      }))
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      {} as never,
      {} as never,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      false
    ) as unknown as MockBot;

    const handler = bot.commandHandlers.get("admin_set_owner");
    expect(handler).toBeDefined();
    await handler?.({
      chat: { type: "private" },
      from: { id: 1 },
      message: { text: "/admin_set_owner ws-1 42" },
      reply
    });

    expect(setOwner).toHaveBeenCalledWith("ws-1", "42", false);
    expect(reply).toHaveBeenCalledWith("Owner set: 42");
  });

  it("parses /admin_create_team and calls workspace service", async () => {
    const reply = vi.fn(async () => undefined);
    const ensureWorkspaceForChatWithResult = vi.fn(async () => ({
      workspace: { id: "ws-1", chatId: "-100123", title: "Alpha Team" },
      result: "created" as const
    }));
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceService = {
      ensureWorkspaceForChatWithResult,
      ensureWorkspaceForChat: vi.fn()
    } as never;
    const setOwner = vi.fn(async () => ({ id: "ws-1", ownerUserId: "1" }));
    const workspaceAdminService = {
      setOwner,
      isOwner: vi.fn(async () => false)
    } as never;
    const workspaceMemberService = {
      upsertOwnerMembership: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "1",
        role: "OWNER",
        joinedAt: new Date("2026-02-16T00:00:00.000Z"),
        lastSeenAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      workspaceService,
      workspaceMemberService,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      false
    ) as unknown as MockBot;

    const handler = bot.commandHandlers.get("admin_create_team");
    expect(handler).toBeDefined();
    await handler?.({
      chat: { type: "private" },
      from: { id: 1 },
      message: { text: "/admin_create_team -100123 Alpha Team" },
      reply
    });

    expect(ensureWorkspaceForChatWithResult).toHaveBeenCalledWith("-100123", "Alpha Team");
    expect(setOwner).toHaveBeenCalledWith("ws-1", "1", false);
    expect(reply).toHaveBeenCalledWith(
      "Team created/exists: workspaceId=ws-1 | chatId=-100123 | title=Alpha Team"
    );
  });

  it("rejects positive chatId in /admin_create_team", async () => {
    const reply = vi.fn(async () => undefined);
    const ensureWorkspaceForChatWithResult = vi.fn(async () => ({
      workspace: { id: "ws-1", chatId: "-100123", title: "Alpha Team" },
      result: "created" as const
    }));
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceService = {
      ensureWorkspaceForChatWithResult,
      ensureWorkspaceForChat: vi.fn()
    } as never;
    const workspaceAdminService = {
      setOwner: vi.fn(async () => ({ id: "ws-1", ownerUserId: "1" })),
      isOwner: vi.fn(async () => false)
    } as never;
    const workspaceMemberService = {
      upsertOwnerMembership: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "1",
        role: "OWNER",
        joinedAt: new Date("2026-02-16T00:00:00.000Z"),
        lastSeenAt: new Date("2026-02-16T00:00:00.000Z")
      }))
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      workspaceService,
      workspaceMemberService,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      false
    ) as unknown as MockBot;

    const handler = bot.commandHandlers.get("admin_create_team");
    expect(handler).toBeDefined();
    await handler?.({
      chat: { type: "private" },
      from: { id: 1 },
      message: { text: "/admin_create_team 1003812536253 Alpha Team" },
      reply
    });

    expect(ensureWorkspaceForChatWithResult).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(
      "Invalid chatId. For groups use negative chatId (usually -100...). Get it via /debug_chat_id in the group."
    );
  });

  it("admin_reset returns forbidden for non-admin", async () => {
    const reply = vi.fn(async () => undefined);
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceAdminService = {
      resetAllWorkspaceData: vi.fn(async () => ({
        workspaceMembers: 1,
        workspaceInvites: 2,
        workspaces: 3
      }))
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      {} as never,
      {} as never,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      true
    ) as unknown as MockBot;
    const handler = bot.commandHandlers.get("admin_reset");
    await handler?.({
      chat: { type: "private", id: 10 },
      from: { id: 2 },
      message: { text: "/admin_reset CONFIRM_DELETE_ALL_TEST_DATA" },
      reply
    });
    expect(reply).toHaveBeenCalledWith("forbidden");
  });

  it("admin_reset returns disabled when ALLOW_ADMIN_RESET is false", async () => {
    const reply = vi.fn(async () => undefined);
    const resetAllWorkspaceData = vi.fn(async () => ({
      workspaceMembers: 1,
      workspaceInvites: 2,
      workspaces: 3
    }));
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceAdminService = { resetAllWorkspaceData } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      {} as never,
      {} as never,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      false
    ) as unknown as MockBot;
    const handler = bot.commandHandlers.get("admin_reset");
    await handler?.({
      chat: { type: "private", id: 10 },
      from: { id: 1 },
      message: { text: "/admin_reset CONFIRM_DELETE_ALL_TEST_DATA" },
      reply
    });
    expect(reply).toHaveBeenCalledWith("reset disabled");
    expect(resetAllWorkspaceData).not.toHaveBeenCalled();
  });

  it("admin_reset requires exact confirmation phrase", async () => {
    const reply = vi.fn(async () => undefined);
    const resetAllWorkspaceData = vi.fn(async () => ({
      workspaceMembers: 1,
      workspaceInvites: 2,
      workspaces: 3
    }));
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceAdminService = { resetAllWorkspaceData } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      {} as never,
      {} as never,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      true
    ) as unknown as MockBot;
    const handler = bot.commandHandlers.get("admin_reset");
    await handler?.({
      chat: { type: "private", id: 10 },
      from: { id: 1 },
      message: { text: "/admin_reset WRONG" },
      reply
    });
    expect(reply).toHaveBeenCalledWith("Send: /admin_reset CONFIRM_DELETE_ALL_TEST_DATA");
    expect(resetAllWorkspaceData).not.toHaveBeenCalled();
  });

  it("admin_reset is DM-only", async () => {
    const reply = vi.fn(async () => undefined);
    const taskService = {} as never;
    const workspaceInviteService = {} as never;
    const workspaceAdminService = {
      resetAllWorkspaceData: vi.fn(async () => ({
        workspaceMembers: 1,
        workspaceInvites: 2,
        workspaces: 3
      }))
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      {} as never,
      {} as never,
      workspaceInviteService,
      workspaceAdminService,
      new Set(["1"]),
      true
    ) as unknown as MockBot;
    const handler = bot.commandHandlers.get("admin_reset");
    await handler?.({
      chat: { type: "group", id: -100 },
      from: { id: 1 },
      message: { text: "/admin_reset CONFIRM_DELETE_ALL_TEST_DATA" },
      reply
    });
    expect(reply).toHaveBeenCalledWith("DM only");
  });

  it("builds assignee choices from workspace members in start flow", async () => {
    const reply = vi.fn(async () => undefined);
    const taskService = {
      startDraftWizard: vi.fn(async () => ({
        status: "STARTED" as const,
        draft: { id: "d-1", sourceChatId: "-100123" }
      }))
    } as never;
    const workspaceService = {
      findWorkspaceByChatId: vi.fn(async () => ({ id: "ws-1", chatId: "-100123", title: "Alpha Team" }))
    } as never;
    const workspaceMemberService = {
      listWorkspaceMembers: vi.fn(async () => [
        {
          id: "wm-1",
          workspaceId: "ws-1",
          userId: "10",
          role: "OWNER"
        },
        {
          id: "wm-2",
          workspaceId: "ws-1",
          userId: "11",
          role: "MEMBER"
        }
      ])
    } as never;
    const bot = createBot(
      "token",
      taskService,
      "my_bot",
      workspaceService,
      workspaceMemberService,
      {} as never,
      {} as never,
      new Set(["1"]),
      false
    ) as unknown as MockBot & { startHandler: Handler | null };

    expect(bot.startHandler).toBeTruthy();
    await bot.startHandler?.({
      chat: { type: "private" },
      from: { id: 1 },
      message: { text: "/start token-1" },
      reply
    });

    const firstCall = reply.mock.calls[0];
    expect(firstCall).toBeDefined();
    const replyPayload = (firstCall?.[1] ?? {}) as unknown as {
      reply_markup?: { inline_keyboard?: Array<Array<{ text: string; callback_data: string }>> };
    };
    const labels = (replyPayload.reply_markup?.inline_keyboard ?? []).flat().map((button) => button.text);
    expect(labels).toEqual(["10 (OWNER)", "11 (MEMBER)"]);
  });
});
