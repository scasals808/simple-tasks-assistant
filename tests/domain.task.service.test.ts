import { describe, expect, it, vi } from "vitest";

import type { Clock } from "../src/domain/ports/clock.port.js";
import type { TaskRepo } from "../src/domain/ports/task.repo.port.js";
import { TaskService } from "../src/domain/tasks/task.service.js";

describe("TaskService.createTask", () => {
  it("builds ACTIVE task, sets timestamps, and persists via repo", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const clock: Clock = { now: () => now };
    const create = vi.fn(async (task) => task);
    const repo: TaskRepo = { create };

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
