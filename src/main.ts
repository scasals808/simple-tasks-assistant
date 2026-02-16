import Fastify from "fastify";
import type { Update } from "telegraf/types";
// @ts-expect-error Node builtin types are not configured in tsconfig.
import { spawnSync } from "node:child_process";

import { createBot } from "./bot/index.js";
import { container } from "./app/container.js";
import { loadEnv } from "./config/env.js";

const env = loadEnv();
const app = Fastify({ logger: true });
const bot = createBot(env.telegramBotToken, container.taskService);
const RECOVERY_MIGRATION_NAME = "20260216193000_task_draft_idempotency";

type CliResult = {
  status: number;
  stdout: string;
  stderr: string;
};

function runPrismaCli(args: string[]): CliResult {
  const processEnv =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const result = spawnSync("pnpm", ["prisma", ...args], {
    env: processEnv,
    encoding: "utf8"
  });
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
}

function containsP3009(output: string): boolean {
  return output.includes("P3009");
}

function printCliOutput(stdout: string, stderr: string): void {
  if (stdout.trim()) {
    console.log(stdout.trimEnd());
  }
  if (stderr.trim()) {
    console.error(stderr.trimEnd());
  }
}

function runStartupMigrationsOrExit(): void {
  const nodeEnv =
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.NODE_ENV ?? "";
  if (nodeEnv !== "production") {
    return;
  }

  console.log("[startup] running prisma migrate deploy");
  const deploy = runPrismaCli(["migrate", "deploy"]);
  printCliOutput(deploy.stdout, deploy.stderr);
  if (deploy.status === 0) {
    console.log("[startup] migrations applied");
    return;
  }

  const deployOutput = `${deploy.stdout}\n${deploy.stderr}`;
  if (!containsP3009(deployOutput)) {
    throw new Error("Prisma migrate deploy failed");
  }

  console.warn(
    "[startup] TEMP recovery path: detected P3009, running migrate resolve --rolled-back"
  );
  const resolve = runPrismaCli([
    "migrate",
    "resolve",
    "--rolled-back",
    RECOVERY_MIGRATION_NAME
  ]);
  printCliOutput(resolve.stdout, resolve.stderr);
  if (resolve.status !== 0) {
    throw new Error("Prisma migrate resolve --rolled-back failed");
  }

  console.log("[startup] retrying prisma migrate deploy after temporary recovery");
  const retry = runPrismaCli(["migrate", "deploy"]);
  printCliOutput(retry.stdout, retry.stderr);
  if (retry.status !== 0) {
    throw new Error("Prisma migrate deploy failed after recovery");
  }

  console.log("[startup] migrations applied");
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

  // Webhook-only mode: acknowledge fast and process update asynchronously.
  void bot.handleUpdate(update).catch((error: unknown) => {
    app.log.error({ error }, "Failed to process Telegram update");
  });

  return { ok: true };
});

runStartupMigrationsOrExit();

app.listen({ host: "0.0.0.0", port: env.port }).catch((error) => {
  app.log.error(error);
  throw error;
});
