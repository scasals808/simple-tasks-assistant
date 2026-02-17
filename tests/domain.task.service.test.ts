import { describe, expect, it, vi } from "vitest";

import type { Clock } from "../src/domain/ports/clock.port.js";
import type { TaskRepo } from "../src/domain/ports/task.repo.port.js";
import { TaskService } from "../src/domain/tasks/task.service.js";

describe("TaskService.createTask", () => {
  it("builds ACTIVE task, sets timestamps, and persists via repo", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const clock: Clock = { now: () => now };
    const create = vi.fn(async (task) => task);
    const repo: TaskRepo = {
      create,
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };

    const service = new TaskService(clock, repo);

    const result = await service.createTask({
      id: "task-1",
      sourceChatId: "chat-1",
      sourceMessageId: "msg-1",
      sourceText: "hello",
      sourceLink: null,
      creatorUserId: "u-1",
      assigneeUserId: "u-2",
      priority: "P1",
      deadlineAt: null
    });

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0]).toMatchObject({
      id: "task-1",
      status: "ACTIVE",
      createdAt: now,
      updatedAt: now
    });
    expect(result).toMatchObject({
      id: "task-1",
      sourceText: "hello",
      priority: "P1",
      status: "ACTIVE"
    });
  });
});

describe("TaskService.getMyTasks", () => {
  it("filters only by assigneeUserId", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const clock: Clock = { now: () => now };
    const findByAssigneeUserId = vi.fn(async () => [
      {
        id: "task-1",
        sourceChatId: "chat-1",
        sourceMessageId: "msg-1",
        sourceText: "hello",
        sourceLink: null,
        creatorUserId: "owner-1",
        assigneeUserId: "u-1",
        priority: "P2" as const,
        deadlineAt: null,
        status: "ACTIVE" as const,
        createdAt: now,
        updatedAt: now
      }
    ]);
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId,
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };

    const service = new TaskService(clock, repo);
    const tasks = await service.getMyTasks("u-1");

    expect(findByAssigneeUserId).toHaveBeenCalledWith("u-1");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.assigneeUserId).toBe("u-1");
  });
});
