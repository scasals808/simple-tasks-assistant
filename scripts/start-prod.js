#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    ...options
  });

  return result;
}

function main() {
  console.log("[startup] begin");
  console.log("[startup] migrations: start");

  const migrateResult = run("pnpm", ["prisma", "migrate", "deploy"], {
    timeout: 90_000,
    killSignal: "SIGTERM"
  });
  if (migrateResult.error && migrateResult.error.code === "ETIMEDOUT") {
    console.error("[startup] migrations: timeout after 90s");
    process.exit(1);
  }
  if (typeof migrateResult.status !== "number" || migrateResult.status !== 0) {
    console.error("[startup] migrations: failed");
    process.exit(1);
  }
  console.log("[startup] migrations: ok");

  if (!existsSync("dist/main.js")) {
    console.error("[startup] dist/main.js not found. Ensure build step runs before start.");
    process.exit(1);
  }
  console.log("[startup] entrypoint: dist/main.js");

  const port = process.env.PORT ?? "3000";
  console.log(`[startup] http: listen PORT=${port}`);
  const startResult = run("node", ["dist/main.js"]);
  process.exit(typeof startResult.status === "number" ? startResult.status : 1);
}

main();
