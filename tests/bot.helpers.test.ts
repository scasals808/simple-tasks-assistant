import { describe, expect, it } from "vitest";

import { buildSourceLink, extractStartPayload } from "../src/bot/index.js";
import { getDeadlineFromChoice } from "../src/bot/scenes/createTask.scene.js";

describe("bot helpers", () => {
  it("builds public source link for username chats", () => {
    const link = buildSourceLink(-100123, "mygroup", 42);
    expect(link).toBe("https://t.me/mygroup/42");
  });

  it("builds source link for private supergroup id when username missing", () => {
    const link = buildSourceLink(-1001234567890, undefined, 7);
    expect(link).toBe("https://t.me/c/1234567890/7");
  });

  it("returns null source link for unsupported chat ids", () => {
    expect(buildSourceLink(-999, undefined, 7)).toBeNull();
  });

  it("extracts /start payload", () => {
    expect(extractStartPayload("/start ct_token")).toBe("ct_token");
    expect(extractStartPayload("/start")).toBeNull();
    expect(extractStartPayload(undefined)).toBeNull();
  });

  it("maps deadline choices to expected values", () => {
    const today = getDeadlineFromChoice("today");
    const tomorrow = getDeadlineFromChoice("tomorrow");
    const none = getDeadlineFromChoice("none");

    expect(today).not.toBeNull();
    expect(tomorrow).not.toBeNull();
    expect(none).toBeNull();

    if (today && tomorrow) {
      expect(tomorrow.getTime()).toBeGreaterThan(today.getTime());
    }
  });
});
