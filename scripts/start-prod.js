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
  console.log("[startup] starting server (migration logic is in src/main.ts)");
  const startCode = run("pnpm", ["exec", "tsx", "src/main.ts"]);
  process.exit(startCode);
}

main();
