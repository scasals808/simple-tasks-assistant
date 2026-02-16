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
      PORT: undefined
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(loadEnv()).toEqual({
      port: 3000,
      telegramBotToken: "token",
      telegramWebhookSecretToken: "secret",
      telegramBotUsername: "my_bot"
    });
  });

  it("throws on invalid port", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      TELEGRAM_BOT_TOKEN: "token",
      TELEGRAM_WEBHOOK_SECRET_TOKEN: "secret",
      BOT_USERNAME: "my_bot",
      PORT: "70000"
    };
    const { loadEnv } = await import("../src/config/env.js");

    expect(() => loadEnv()).toThrow("Invalid PORT value");
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
});
