import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("ephemeral utils", () => {
  it("sendEphemeral does nothing outside group chats", async () => {
    const { sendEphemeral } = await import("../src/bot/utils/ephemeral.js");
    const reply = vi.fn(async () => ({ chat: { id: 1 }, message_id: 1 }));
    const repo = {
      schedule: vi.fn(),
      findDue: vi.fn(),
      markDone: vi.fn(),
      markFailed: vi.fn()
    };

    await sendEphemeral(
      {
        chat: { id: 1, type: "private" },
        reply
      } as unknown as never,
      repo as never,
      "text"
    );

    expect(reply).not.toHaveBeenCalled();
    expect(repo.schedule).not.toHaveBeenCalled();
  });

  it("sendEphemeral schedules deletion for group chat", async () => {
    const { sendEphemeral } = await import("../src/bot/utils/ephemeral.js");
    const reply = vi.fn(async () => ({ chat: { id: -1001 }, message_id: 42 }));
    const repo = {
      schedule: vi.fn(async () => undefined),
      findDue: vi.fn(),
      markDone: vi.fn(),
      markFailed: vi.fn()
    };

    await sendEphemeral(
      {
        chat: { id: -1001, type: "group" },
        reply
      } as unknown as never,
      repo as never,
      "text",
      1234
    );

    expect(reply).toHaveBeenCalledWith("text");
    expect(repo.schedule).toHaveBeenCalledTimes(1);
  });

  it("processDueDeletions marks done on successful delete", async () => {
    const { processDueDeletions } = await import("../src/bot/utils/ephemeral.js");
    const repo = {
      schedule: vi.fn(),
      findDue: vi.fn(async () => [
        { id: "d1", chatId: "100", messageId: "10" }
      ]),
      markDone: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined)
    };
    const ctx = {
      telegram: {
        deleteMessage: vi.fn(async () => true)
      }
    };

    await processDueDeletions(ctx as never, repo as never, 20);

    expect(ctx.telegram.deleteMessage).toHaveBeenCalledWith(100, 10);
    expect(repo.markDone).toHaveBeenCalledWith("d1");
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("processDueDeletions marks failed on delete error", async () => {
    const { processDueDeletions } = await import("../src/bot/utils/ephemeral.js");
    const repo = {
      schedule: vi.fn(),
      findDue: vi.fn(async () => [
        { id: "d2", chatId: "100", messageId: "11" }
      ]),
      markDone: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined)
    };
    const ctx = {
      telegram: {
        deleteMessage: vi.fn(async () => {
          throw { response: { error_code: 400, description: "not found" } };
        })
      }
    };

    await processDueDeletions(ctx as never, repo as never, 20);

    expect(repo.markFailed).toHaveBeenCalledWith("d2", "not found");
    expect(repo.markDone).not.toHaveBeenCalled();
  });

  it("disables persistence on missing table errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { scheduleSentMessageDeletion, processDueDeletions } = await import(
      "../src/bot/utils/ephemeral.js"
    );
    const repo = {
      schedule: vi.fn(async () => {
        throw { code: "P2021" };
      }),
      findDue: vi.fn(async () => {
        throw { code: "P2021" };
      }),
      markDone: vi.fn(async () => undefined),
      markFailed: vi.fn(async () => undefined)
    };

    await scheduleSentMessageDeletion(repo as never, "1", "2");
    await processDueDeletions({ telegram: { deleteMessage: vi.fn() } } as never, repo as never);

    expect(warn).toHaveBeenCalledWith("[pending-deletion-disabled-missing-table]");
  });
});
