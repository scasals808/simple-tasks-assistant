import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
});

describe("loadEnv", () => {
  it("loads required env with default port", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET_TOKEN: "secret",
      BOT_USERNAME: "my_bot",
      ADMIN_USER_IDS: "1,2",
      PORT: undefined
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(loadEnv()).toEqual({
      port: 3000,
      telegramBotToken: "token",
      telegramWebhookSecretToken: "secret",
      telegramBotUsername: "my_bot",
      adminUserIds: ["1", "2"],
      allowAdminReset: false
    });
  });

  it("throws on invalid port", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET_TOKEN: "secret",
      BOT_USERNAME: "my_bot",
      ADMIN_USER_IDS: "1,2",
      PORT: "70000"
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(() => loadEnv()).toThrow("Invalid PORT value");
  });

  it("loads explicit valid port and empty admin list", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET_TOKEN: "secret",
      BOT_USERNAME: "my_bot",
      ADMIN_USER_IDS: "",
      PORT: "8080"
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(loadEnv().port).toBe(8080);
    expect(loadEnv().adminUserIds).toEqual([]);
    expect(loadEnv().allowAdminReset).toBe(false);
  });

  it("throws when required vars are missing", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_WEBHOOK_SECRET_TOKEN: undefined,
      BOT_USERNAME: undefined
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(() => loadEnv()).toThrow("TELEGRAM_BOT_TOKEN is required");
  });

  it("throws when webhook secret is missing", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET_TOKEN: undefined,
      BOT_USERNAME: "my_bot"
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(() => loadEnv()).toThrow("TELEGRAM_WEBHOOK_SECRET_TOKEN is required");
  });

  it("throws when bot username is missing", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET_TOKEN: "secret",
      BOT_USERNAME: undefined
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(() => loadEnv()).toThrow("BOT_USERNAME is required");
  });

  it("checks admin allowlist", async () => {
    const { isAdmin } = await import("../src/config/env.js");
    expect(isAdmin("1", ["1", "2"])).toBe(true);
    expect(isAdmin(2, ["1", "2"])).toBe(true);
    expect(isAdmin("3", ["1", "2"])).toBe(false);
  });

  it("parses ALLOW_ADMIN_RESET=true", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET_TOKEN: "secret",
      BOT_USERNAME: "my_bot",
      ALLOW_ADMIN_RESET: "true"
    };
    const { loadEnv } = await import("../src/config/env.js");
    expect(loadEnv().allowAdminReset).toBe(true);
  });
});
