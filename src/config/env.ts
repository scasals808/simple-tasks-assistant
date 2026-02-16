type EnvConfig = {
  port: number;
  telegramBotToken: string;
  telegramWebhookSecretToken: string;
  telegramBotUsername: string;
  adminUserIds: string[];
  allowAdminReset: boolean;
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

function parseAdminUserIds(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAllowAdminReset(value: string | undefined): boolean {
  return value === "true";
}

export function isAdmin(userId: string | number, adminUserIds: string[]): boolean {
  return adminUserIds.includes(String(userId));
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

  const telegramBotUsername = rawEnv.BOT_USERNAME;
  if (!telegramBotUsername) {
    throw new Error("BOT_USERNAME is required");
  }

  return {
    port: parsePort(rawEnv.PORT),
    telegramBotToken,
    telegramWebhookSecretToken,
    telegramBotUsername,
    adminUserIds: parseAdminUserIds(rawEnv.ADMIN_USER_IDS),
    allowAdminReset: parseAllowAdminReset(rawEnv.ALLOW_ADMIN_RESET)
  };
}
