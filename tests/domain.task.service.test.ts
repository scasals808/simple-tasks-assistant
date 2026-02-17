import { describe, expect, it, vi } from "vitest";

import type { Clock } from "../src/domain/ports/clock.port.js";
import type { TaskRepo } from "../src/domain/ports/task.repo.port.js";
import type { WorkspaceMemberRepo } from "../src/domain/ports/workspace-member.repo.port.js";
import { TaskService } from "../src/domain/tasks/task.service.js";

describe("TaskService.createTask", () => {
  it("builds ACTIVE task, sets timestamps, and persists via repo", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const clock: Clock = { now: () => now };
    const create = vi.fn(async (task) => task);
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
        lastSeenAt: now
      })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const repo: TaskRepo = {
      create,
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
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
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };

    const service = new TaskService(clock, repo, workspaceMemberRepo);

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
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
        lastSeenAt: now
      })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId,
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };

    const service = new TaskService(clock, repo, workspaceMemberRepo);
    const tasks = await service.getMyTasks("u-1");

    expect(findByAssigneeUserId).toHaveBeenCalledWith("u-1");
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.assigneeUserId).toBe("u-1");
  });
});

describe("TaskService list use-cases", () => {
  it("assigned filtering delegates to assigned repo with membership gate", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
        lastSeenAt: now
      })),
      findActiveMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
        lastSeenAt: now
      })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const listAssignedTasks = vi.fn(async () => []);
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks,
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => now }, repo, workspaceMemberRepo);

    const result = await service.listAssignedTasks({
      workspaceId: "ws-1",
      viewerUserId: "u-1"
    });
    expect(result.status).toBe("OK");
    expect(listAssignedTasks).toHaveBeenCalledWith("ws-1", "u-1", 20);
  });

  it("created filtering delegates to created repo with deterministic order", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
        lastSeenAt: now
      })),
      findActiveMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
        lastSeenAt: now
      })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const sorted = [
      {
        id: "a",
        sourceChatId: "c",
        sourceMessageId: "1",
        sourceText: "x",
        sourceLink: null,
        creatorUserId: "u-1",
        assigneeUserId: "u-1",
        priority: "P1" as const,
        deadlineAt: new Date("2026-02-20T00:00:00.000Z"),
        status: "ACTIVE" as const,
        createdAt: now,
        updatedAt: now
      },
      {
        id: "b",
        sourceChatId: "c",
        sourceMessageId: "2",
        sourceText: "x",
        sourceLink: null,
        creatorUserId: "u-1",
        assigneeUserId: "u-1",
        priority: "P2" as const,
        deadlineAt: null,
        status: "ACTIVE" as const,
        createdAt: now,
        updatedAt: now
      }
    ];
    const listCreatedTasks = vi.fn(async () => sorted);
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks,
      findDraftByCreatorAndStep: vi.fn(async () => null),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected: vi.fn(async () => {
        throw new Error("unused");
      }),
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => now }, repo, workspaceMemberRepo);

    const result = await service.listCreatedTasks({
      workspaceId: "ws-1",
      viewerUserId: "u-1"
    });
    expect(result).toEqual({ status: "OK", tasks: sorted });
    expect(listCreatedTasks).toHaveBeenCalledWith("ws-1", "u-1", 20);
  });

  it("returns NOT_IN_WORKSPACE when membership is missing", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
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
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => now }, repo, workspaceMemberRepo);

    const result = await service.listAssignedTasks({
      workspaceId: "ws-1",
      viewerUserId: "u-1"
    });
    expect(result).toEqual({ status: "NOT_IN_WORKSPACE" });
  });
});

describe("TaskService DM draft flow", () => {
  it("startDmDraft creates draft with dm:* sourceChatId and non-empty sourceMessageId", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => null),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const createDraft = vi.fn(async (input: { token: string }) => ({
      id: "d-1",
      token: input.token,
      status: "PENDING" as const,
      step: "enter_text" as const,
      createdTaskId: null,
      workspaceId: "ws-1",
      sourceChatId: "dm:u-1",
      sourceMessageId: "source-1",
      sourceText: "",
      sourceLink: null,
      creatorUserId: "u-1",
      assigneeId: null,
      priority: null,
      deadlineAt: null,
      createdAt: now,
      updatedAt: now
    }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft,
      findDraftByToken: vi.fn(async () => null),
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
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => now }, repo, workspaceMemberRepo);

    await service.startDmDraft({ workspaceId: "ws-1", creatorUserId: "u-1" });
    const call = createDraft.mock.calls[0]?.[0] as {
      sourceChatId: string;
      sourceMessageId: string;
      step: string;
    };
    expect(call.sourceChatId).toBe("dm:u-1");
    expect(call.step).toBe("enter_text");
    expect(call.sourceMessageId.length).toBeGreaterThan(0);
  });

  it("enter_text transition is guarded and does not advance on stale step", async () => {
    const now = new Date("2026-02-16T00:00:00.000Z");
    const workspaceMemberRepo: WorkspaceMemberRepo = {
      upsertMember: vi.fn(async () => {
        throw new Error("unused");
      }),
      findMember: vi.fn(async () => null),
      findActiveMember: vi.fn(async () => ({
        id: "wm-1",
        workspaceId: "ws-1",
        userId: "u-1",
        role: "MEMBER",
        status: "ACTIVE",
        joinedAt: now,
        lastSeenAt: now
      })),
      listByWorkspace: vi.fn(async () => []),
      findLatestWorkspaceIdByUser: vi.fn(async () => null),
      setMemberStatus: vi.fn(async () => {
        throw new Error("unused");
      })
    };
    const updateDraftStepIfExpected = vi.fn(async () => ({
      updated: false,
      draft: {
        id: "d-1",
        token: "t-1",
        status: "PENDING" as const,
        step: "CHOOSE_ASSIGNEE" as const,
        createdTaskId: null,
        workspaceId: "ws-1",
        sourceChatId: "dm:u-1",
        sourceMessageId: "source-1",
        sourceText: "text",
        sourceLink: null,
        creatorUserId: "u-1",
        assigneeId: null,
        priority: null,
        deadlineAt: null,
        createdAt: now,
        updatedAt: now
      }
    }));
    const repo: TaskRepo = {
      create: vi.fn(async (task) => task),
      createDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      findDraftByToken: vi.fn(async () => null),
      findPendingDraftBySource: vi.fn(async () => null),
      findTaskBySource: vi.fn(async () => null),
      findByAssigneeUserId: vi.fn(async () => []),
      listAssignedTasks: vi.fn(async () => []),
      listCreatedTasks: vi.fn(async () => []),
      findDraftByCreatorAndStep: vi.fn(async () => ({
        id: "d-1",
        token: "t-1",
        status: "PENDING" as const,
        step: "enter_text" as const,
        createdTaskId: null,
        workspaceId: "ws-1",
        sourceChatId: "dm:u-1",
        sourceMessageId: "source-1",
        sourceText: "",
        sourceLink: null,
        creatorUserId: "u-1",
        assigneeId: null,
        priority: null,
        deadlineAt: null,
        createdAt: now,
        updatedAt: now
      })),
      findAwaitingDeadlineDraftByCreator: vi.fn(async () => null),
      updateDraftStepIfExpected,
      updateDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      createFromDraft: vi.fn(async () => {
        throw new Error("unused");
      }),
      markDraftFinal: vi.fn(async () => undefined)
    };
    const service = new TaskService({ now: () => now }, repo, workspaceMemberRepo);

    const result = await service.applyDmDraftText("u-1", "text");
    expect(result.status).toBe("STALE_STEP");
    expect(updateDraftStepIfExpected).toHaveBeenCalledWith(
      "d-1",
      "enter_text",
      expect.objectContaining({ step: "CHOOSE_ASSIGNEE", sourceText: "text" })
    );
  });
});
