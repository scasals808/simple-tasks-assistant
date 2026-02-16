import { describe, expect, it } from "vitest";

import { priorityRank, sortTasks } from "../src/domain/tasks/task.rules.js";
import type { Task } from "../src/domain/tasks/task.types.js";

function task(overrides: Partial<Task>): Task {
  return {
    id: "t",
    sourceChatId: "c",
    sourceMessageId: "m",
    sourceText: "txt",
    sourceLink: null,
    creatorUserId: "u1",
    assigneeUserId: "u2",
    priority: "P2",
    deadlineAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides
  };
}

describe("priorityRank", () => {
  it("maps priorities in expected order", () => {
    expect(priorityRank("P1")).toBe(1);
    expect(priorityRank("P2")).toBe(2);
    expect(priorityRank("P3")).toBe(3);
  });
});

describe("sortTasks", () => {
  it("keeps input array immutable", () => {
    const original = [
      task({ id: "a", priority: "P3" }),
      task({ id: "b", priority: "P1" })
    ];

    const sorted = sortTasks(original);

    expect(original.map((t) => t.id)).toEqual(["a", "b"]);
    expect(sorted.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("uses createdAt as tie-breaker when priority and deadline match", () => {
    const first = task({
      id: "newer",
      priority: "P1",
      deadlineAt: new Date("2026-01-10T00:00:00.000Z"),
      createdAt: new Date("2026-01-05T00:00:00.000Z")
    });
    const second = task({
      id: "older",
      priority: "P1",
      deadlineAt: new Date("2026-01-10T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z")
    });

    const sorted = sortTasks([first, second]);
    expect(sorted.map((t) => t.id)).toEqual(["older", "newer"]);
  });
});
