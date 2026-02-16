type TelegramResponse = {
  ok: boolean;
  description?: string;
  result?: unknown;
};

type ScopeType = "default" | "all_group_chats";
type Action = "set" | "get" | "delete";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function callTelegram(
  token: string,
  method: "setMyCommands" | "getMyCommands" | "deleteMyCommands",
  body?: URLSearchParams
): Promise<TelegramResponse> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  const json = (await response.json()) as TelegramResponse;
  if (!response.ok || !json.ok) {
    throw new Error(
      `Telegram API ${method} failed: ${json.description ?? response.statusText}`
    );
  }

  return json;
}

async function applyForScope(
  token: string,
  action: Action,
  scopeType: ScopeType
): Promise<void> {
  const scope = JSON.stringify({ type: scopeType });

  if (action === "set") {
    await callTelegram(
      token,
      "setMyCommands",
      new URLSearchParams({
        commands: JSON.stringify([
          {
            command: "task",
            description: "Создать задачу из reply"
          },
          {
            command: "help",
            description: "Помощь"
          }
        ]),
        scope
      })
    );
    console.log(`[${scopeType}] setMyCommands: OK`);
    return;
  }

  if (action === "get") {
    const result = await callTelegram(
      token,
      "getMyCommands",
      new URLSearchParams({ scope })
    );
    console.log(`[${scopeType}] getMyCommands:`);
    console.log(JSON.stringify(result.result ?? [], null, 2));
    return;
  }

  await callTelegram(
    token,
    "deleteMyCommands",
    new URLSearchParams({ scope })
  );
  console.log(`[${scopeType}] deleteMyCommands: OK`);
}

async function main(): Promise<void> {
  const action = process.argv[2] as Action | undefined;
  if (!action || !["set", "get", "delete"].includes(action)) {
    throw new Error("Usage: tsx scripts/telegram-commands.ts <set|get|delete>");
  }

  const token = requireEnv("TELEGRAM_BOT_TOKEN");
  const scopes: ScopeType[] = ["default", "all_group_chats"];

  for (const scope of scopes) {
    await applyForScope(token, action, scope);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
