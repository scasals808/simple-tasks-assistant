import Fastify from "fastify";
import type { Update } from "telegraf/types";

import { createBot } from "./bot/index.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = Fastify({ logger: true });
const bot = createBot(env.telegramBotToken);

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

  // Webhook-only mode: acknowledge fast and process update asynchronously.
  void bot.handleUpdate(update).catch((error: unknown) => {
    app.log.error({ error }, "Failed to process Telegram update");
  });

  return { ok: true };
});

app.listen({ host: "0.0.0.0", port: env.port }).catch((error) => {
  app.log.error(error);
  throw error;
});
