import { describe, expect, it } from "vitest";

import { parseStartPayload, selectStartRoute } from "../src/bot/start/start.router.js";

describe("start payload router", () => {
  it("parses join payload", () => {
    expect(parseStartPayload("join_token123")).toEqual({
      type: "join",
      token: "token123"
    });
  });

  it("parses task payload", () => {
    expect(parseStartPayload("ct_token")).toEqual({
      type: "task",
      token: "ct_token"
    });
  });

  it("parses empty payload", () => {
    expect(parseStartPayload(null)).toEqual({
      type: "none",
      token: null
    });
  });

  it("selects route from parsed payload", () => {
    expect(selectStartRoute({ type: "join", token: "abc" })).toBe("join");
    expect(selectStartRoute({ type: "task", token: "abc" })).toBe("task");
    expect(selectStartRoute({ type: "none", token: null })).toBe("plain");
  });
});
