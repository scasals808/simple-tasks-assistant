import { randomUUID } from "node:crypto";

import { container } from "../src/app/container.js";
import { prisma } from "../src/infra/db/prisma.js";

async function main(): Promise<void> {
  const id = randomUUID();

  const created = await container.taskService.createTask({
    id,
    sourceChatId: "dev-chat",
    sourceMessageId: "dev-message",
    sourceText: "Dev task sample",
    sourceLink: null,
    creatorUserId: "dev-user-1",
    assigneeUserId: "dev-user-2",
    priority: "P2",
    deadlineAt: null
  });

  console.log(`Created task id: ${created.id}`);

  const dbTask = await prisma.task.findUnique({
    where: { id: created.id }
  });

  console.log(`Task persisted: ${dbTask ? "yes" : "no"}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
