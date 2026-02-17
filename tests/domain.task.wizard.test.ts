import { describe, expect, it, vi } from "vitest";

import type { TaskRepo } from "../src/domain/ports/task.repo.port.js";
import type { Task } from "../src/domain/tasks/task.types.js";
import { TaskService } from "../src/domain/tasks/task.service.js";

function makeTask(id: string): Task {
  return {
    id,
    sourceChatId: "chat-1",
    sourceMessageId: "msg-1",
    sourceText: "text",
    sourceLink: null,
    creatorUserId: "u-1",
    assigneeUserId: "ivan",
    priority: "P2",
    deadlineAt: null,
    status: "ACTIVE",
    createdAt: new Date("2026-02-16T00:00:00.000Z"),
    updatedAt: new Date("2026-02-16T00:00:00.000Z")
  };
}

function makeDraft() {
  return {
    id: "d-1",
    token: "t-1",
    status: "PENDING" as const,
    step: "CHOOSE_ASSIGNEE" as const,
    createdTaskId: null,
    sourceChatId: "chat-1",
    sourceMessageId: "msg-1",
    sourceText: "text",
    sourceLink: null,
    creatorUserId: "u-1",
    assigneeId: null,
    priority: null,
    deadlineAt: null,
    createdAt: new Date("2026-02-16T00:00:00.000Z"),
    updatedAt: new Date("2026-02-16T00:00:00.000Z")
  };
}

describe("TaskService wizard flow", () => {
  it("starts wizard when no task exists", async () => {
    const draft = makeDraft();
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo);

    const result = await service.startDraftWizard("t-1", "u-1");
    expect(result.status).toBe("STARTED");
  });

  it("returns ALREADY_EXISTS on wizard start when task exists", async () => {
    const draft = makeDraft();
    const existing = makeTask("task-existing");
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findTaskBySource: vi.fn(async () => existing),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo);

    const result = await service.startDraftWizard("t-1", "u-1");
    expect(result).toEqual({ status: "ALREADY_EXISTS", task: existing });
  });

  it("setAssignee transitions to CHOOSE_PRIORITY", async () => {
    const draft = makeDraft();
    const updateDraft = vi.fn(async (_id, patch) => ({ ...draft, ...patch }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft,
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo);

    await service.setDraftAssignee("t-1", "u-1", "maria");
    expect(updateDraft).toHaveBeenCalledWith("d-1", {
      assigneeId: "maria",
      step: "CHOOSE_PRIORITY"
    });
  });

  it("setPriority transitions to CHOOSE_DEADLINE", async () => {
    const draft = { ...makeDraft(), assigneeId: "maria" };
    const updateDraft = vi.fn(async (_id, patch) => ({ ...draft, ...patch }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft,
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo);

    await service.setDraftPriority("t-1", "u-1", "P1");
    expect(updateDraft).toHaveBeenCalledWith("d-1", {
      priority: "P1",
      step: "CHOOSE_DEADLINE"
    });
  });

  it("applies deadline preset and manual date validation", async () => {
    const draft = { ...makeDraft(), assigneeId: "maria", priority: "P1" as const };
    const updateDraft = vi.fn(async (_id, patch) => ({ ...draft, ...patch }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => draft),
      updateDraft,
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date("2026-02-16T10:00:00.000Z") }, repo);

    const today = await service.setDraftDeadlineChoice("t-1", "u-1", "today");
    expect(today.status).toBe("UPDATED");
    const invalid = await service.setDraftDeadlineFromText("u-1", "2026-99-99");
    expect(invalid.status).toBe("INVALID_DATE");
    const valid = await service.setDraftDeadlineFromText("u-1", "2026-02-20");
    expect(valid.status).toBe("UPDATED");
  });

  it("finalize returns CREATED and marks draft FINAL", async () => {
    const draft = {
      ...makeDraft(),
      step: "CONFIRM" as const,
      assigneeId: "maria",
      priority: "P1" as const
    };
    const createFromDraft = vi.fn(async () => ({ status: "CREATED" as const, task: makeTask("task-1") }));
    const markDraftFinal = vi.fn(async () => undefined);
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft,
      markDraftFinal
    };
    const service = new TaskService({ now: () => new Date() }, repo);

    const result = await service.finalizeDraft("t-1", "u-1");
    expect(result?.status).toBe("CREATED");
    expect(markDraftFinal).toHaveBeenCalledWith("d-1", "task-1");
  });

  it("repeat finalize returns ALREADY_EXISTS", async () => {
    const draft = {
      ...makeDraft(),
      status: "FINAL" as const,
      step: "FINAL" as const,
      createdTaskId: "task-existing",
      assigneeId: "maria",
      priority: "P1" as const
    };
    const existing = makeTask("task-existing");
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findTaskBySource: vi.fn(async () => existing),
      findByAssigneeUserId: vi.fn(async () => []),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo);

    const result = await service.finalizeDraft("t-1", "u-1");
    expect(result).toEqual({ status: "ALREADY_EXISTS", task: existing });
  });
});
