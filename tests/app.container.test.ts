import { describe, expect, it } from "vitest";

import { container } from "../src/app/container.js";

describe("app container", () => {
  it("exports expected services and repos", () => {
    expect(container.clock).toBeDefined();
    expect(typeof container.clock.now).toBe("function");
    expect(container.taskRepo).toBeDefined();
    expect(container.taskService).toBeDefined();
    expect(container.workspaceRepo).toBeDefined();
    expect(container.workspaceService).toBeDefined();
    expect(container.workspaceMemberRepo).toBeDefined();
    expect(container.workspaceMemberService).toBeDefined();
    expect(container.workspaceInviteRepo).toBeDefined();
    expect(container.workspaceInviteService).toBeDefined();
  });
});
