type EnvConfig = {
  port: number;
  telegramBotToken: string;
  telegramWebhookSecretToken: string;
};

const rawEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

function parsePort(value: string | undefined): number {
  if (!value) return 3000;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error("Invalid PORT value");
  }
  return parsed;
}

export function loadEnv(): EnvConfig {
  const telegramBotToken = rawEnv.TELEGRAM_BOT_TOKEN;
  if (!telegramBotToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is required");
  }

  const telegramWebhookSecretToken = rawEnv.TELEGRAM_WEBHOOK_SECRET_TOKEN;
  if (!telegramWebhookSecretToken) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET_TOKEN is required");
  }

  return {
    port: parsePort(rawEnv.PORT),
    telegramBotToken,
    telegramWebhookSecretToken
  };
}
