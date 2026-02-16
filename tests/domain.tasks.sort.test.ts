import { describe, expect, it } from "vitest";

import { sortTasks } from "../src/domain/tasks/task.rules.js";
import type { Task } from "../src/domain/tasks/task.types.js";

describe("sortTasks", () => {
  it("sorts by priority, deadline, then createdAt", () => {
    const tasks: Task[] = [
      {
        id: "t4",
        sourceChatId: "chat",
        sourceMessageId: "msg4",
        sourceText: "text4",
        sourceLink: null,
        creatorUserId: "u1",
        assigneeUserId: "u2",
        priority: "P2",
        deadlineAt: null,
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-01T10:00:00.000Z")
      },
      {
        id: "t1",
        sourceChatId: "chat",
        sourceMessageId: "msg1",
        sourceText: "text1",
        sourceLink: null,
        creatorUserId: "u1",
        assigneeUserId: "u2",
        priority: "P1",
        deadlineAt: new Date("2026-01-03T10:00:00.000Z"),
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-01T10:00:00.000Z")
      },
      {
        id: "t2",
        sourceChatId: "chat",
        sourceMessageId: "msg2",
        sourceText: "text2",
        sourceLink: null,
        creatorUserId: "u1",
        assigneeUserId: "u2",
        priority: "P1",
        deadlineAt: new Date("2026-01-02T10:00:00.000Z"),
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-01T10:00:00.000Z")
      },
      {
        id: "t3",
        sourceChatId: "chat",
        sourceMessageId: "msg3",
        sourceText: "text3",
        sourceLink: null,
        creatorUserId: "u1",
        assigneeUserId: "u2",
        priority: "P1",
        deadlineAt: null,
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-01T10:00:00.000Z")
      },
      {
        id: "t5",
        sourceChatId: "chat",
        sourceMessageId: "msg5",
        sourceText: "text5",
        sourceLink: null,
        creatorUserId: "u1",
        assigneeUserId: "u2",
        priority: "P3",
        deadlineAt: new Date("2026-01-01T10:00:00.000Z"),
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
        updatedAt: new Date("2026-01-01T10:00:00.000Z")
      }
    ];

    const sorted = sortTasks(tasks);
    expect(sorted.map((task) => task.id)).toEqual(["t2", "t1", "t3", "t4", "t5"]);
  });
});
