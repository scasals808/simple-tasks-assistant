import { describe, expect, it, vi } from "vitest";

import type { TaskRepo } from "../src/domain/ports/task.repo.port.js";
import type { WorkspaceMemberRepo } from "../src/domain/ports/workspace-member.repo.port.js";
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
    workspaceId: "ws-1",
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
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({ id: "wm-1", workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", joinedAt: new Date(), lastSeenAt: new Date() })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo, workspaceMemberRepo);

    const result = await service.startDraftWizard("t-1", "u-1");
    expect(result.status).toBe("STARTED");
  });

  it("returns ALREADY_EXISTS on wizard start when task exists", async () => {
    const draft = makeDraft();
    const existing = makeTask("task-existing");
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({ id: "wm-1", workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", joinedAt: new Date(), lastSeenAt: new Date() })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => existing),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo, workspaceMemberRepo);

    const result = await service.startDraftWizard("t-1", "u-1");
    expect(result).toEqual({ status: "ALREADY_EXISTS", task: existing });
  });

  it("setAssignee transitions to CHOOSE_PRIORITY", async () => {
    const draft = makeDraft();
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({ id: "wm-1", workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", joinedAt: new Date(), lastSeenAt: new Date() })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const updateDraft = vi.fn(async (_id, patch) => ({ ...draft, ...patch }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft,
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo, workspaceMemberRepo);

    await service.setDraftAssignee("t-1", "u-1", "maria");
    expect(updateDraft).toHaveBeenCalledWith("d-1", {
      assigneeId: "maria",
      step: "CHOOSE_PRIORITY"
    });
  });

  it("setPriority transitions to CHOOSE_DEADLINE", async () => {
    const draft = { ...makeDraft(), assigneeId: "maria" };
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({ id: "wm-1", workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", joinedAt: new Date(), lastSeenAt: new Date() })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const updateDraft = vi.fn(async (_id, patch) => ({ ...draft, ...patch }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft,
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo, workspaceMemberRepo);

    await service.setDraftPriority("t-1", "u-1", "P1");
    expect(updateDraft).toHaveBeenCalledWith("d-1", {
      priority: "P1",
      step: "CHOOSE_DEADLINE"
    });
  });

  it("applies deadline preset and manual date validation", async () => {
    const draft = { ...makeDraft(), assigneeId: "maria", priority: "P1" as const };
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({ id: "wm-1", workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", joinedAt: new Date(), lastSeenAt: new Date() })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const updateDraft = vi.fn(async (_id, patch) => ({ ...draft, ...patch }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => draft),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft,
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService(
      { now: () => new Date("2026-02-16T10:00:00.000Z") },
      repo,
      workspaceMemberRepo
    );

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
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({ id: "wm-1", workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", joinedAt: new Date(), lastSeenAt: new Date() })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft,
      markDraftFinal
    };
    const service = new TaskService({ now: () => new Date() }, repo, workspaceMemberRepo);

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
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({ id: "wm-1", workspaceId: "ws-1", userId: "u-1", role: "MEMBER", status: "ACTIVE", joinedAt: new Date(), lastSeenAt: new Date() })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => draft),
      findDraftByToken: vi.fn(async () => draft),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => existing),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft: vi.fn(async (_id, patch) => ({ ...draft, ...patch })),
      createFromDraft: vi.fn(async () => ({ status: "CREATED", task: makeTask("task-1") })),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => new Date() }, repo, workspaceMemberRepo);

    const result = await service.finalizeDraft("t-1", "u-1");
    expect(result).toEqual({ status: "ALREADY_EXISTS", task: existing });
  });
});
