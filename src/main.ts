import Fastify from "fastify";
import type { Telegraf } from "telegraf";
import type { Update } from "telegraf/types";

import { createBot } from "./bot/index.js";
import { container } from "./app/container.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = Fastify({ logger: true });
let bot: Telegraf | null = null;

function getBot(): Telegraf {
  if (bot) {
    return bot;
  }
  bot = createBot(
    env.telegramBotToken,
    container.taskService,
    env.telegramBotUsername,
    container.workspaceService,
    container.workspaceMemberService,
    container.workspaceInviteService,
    container.workspaceAdminService,
    env.adminUserIds,
    env.allowAdminReset
  );
  return bot;
}

app.get("/health", async () => ({ ok: true }));

// Render Free target: webhook-only mode, no background workers.
app.post("/telegram/webhook", async (request, reply) => {
  const incomingSecret = request.headers["x-telegram-bot-api-secret-token"];
  const secret =
    typeof incomingSecret === "string"
      ? incomingSecret
      : Array.isArray(incomingSecret)
        ? incomingSecret[0]
        : undefined;

  if (secret !== env.telegramWebhookSecretToken) {
    return reply.code(401).send({ ok: false });
  }

  const update = request.body as Update;
  const activeBot = getBot();

  // Webhook-only mode: acknowledge fast and process update asynchronously.
  void activeBot.handleUpdate(update).catch((error: unknown) => {
    app.log.error({ error }, "Failed to process Telegram update");
  });

  return { ok: true };
});

async function bootstrap(): Promise<void> {
  await app.listen({ host: "0.0.0.0", port: env.port });
  console.log(`[startup] http: listen PORT=${env.port}`);
}

bootstrap().catch((error) => {
  app.log.error(error);
  throw error;
});
