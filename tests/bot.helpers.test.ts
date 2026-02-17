import { describe, expect, it } from "vitest";

import {
  buildMainMenuRows,
  buildSourceLink,
  extractStartPayload,
  parseStartPayload
} from "../src/bot/index.js";

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

  it("routes /start payload types", () => {
    expect(parseStartPayload("join_token123")).toEqual({
      type: "join",
      token: "token123"
    });
    expect(parseStartPayload("ct_token")).toEqual({
      type: "task",
      token: "ct_token"
    });
    expect(parseStartPayload(null)).toEqual({
      type: "none",
      token: null
    });
  });

  it("builds menu rows without admin button for non-admin", () => {
    const rows = buildMainMenuRows(2, new Set(["1"]));
    expect(rows).toEqual([["📥 Мне назначено", "✍️ Я создал"], ["➕ Новая задача", "ℹ️ Помощь"]]);
  });

  it("builds menu rows with admin button for admin user", () => {
    const rows = buildMainMenuRows(1, new Set(["1"]));
    expect(rows).toEqual([
      ["📥 Мне назначено", "✍️ Я создал"],
      ["➕ Новая задача", "ℹ️ Помощь"],
      ["Admin"]
    ]);
  });

});
