#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });

  if (typeof result.status === "number") {
    return result.status;
  }

  return 1;
}

function main() {
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    console.log("[startup] running prisma migrate deploy");
    const migrateCode = run("pnpm", ["prisma", "migrate", "deploy"]);
    if (migrateCode !== 0) {
      process.exit(1);
    }
    console.log("[startup] migrations applied");
  }

  console.log("[startup] starting server");
  const startCode = run("pnpm", ["exec", "tsx", "src/main.ts"]);
  process.exit(startCode);
}

main();
