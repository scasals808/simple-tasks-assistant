type TelegramResponse = {
  ok: boolean;
  description?: string;
  result?: unknown;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function callTelegram(
  token: string,
  method: "setMyCommands" | "deleteMyCommands",
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

async function main(): Promise<void> {
  const action = process.argv[2] as "set" | "delete" | undefined;
  if (!action || !["set", "delete"].includes(action)) {
    throw new Error("Usage: tsx scripts/telegram-commands.ts <set|delete>");
  }

  const token = requireEnv("TELEGRAM_BOT_TOKEN");

  if (action === "set") {
    await callTelegram(
      token,
      "setMyCommands",
      new URLSearchParams({
        commands: JSON.stringify([
          {
            command: "task",
            description: "Create a task from a replied message"
          }
        ]),
        scope: JSON.stringify({ type: "default" })
      })
    );

    console.log("Telegram commands set successfully");
    return;
  }

  await callTelegram(
    token,
    "deleteMyCommands",
    new URLSearchParams({
      scope: JSON.stringify({ type: "default" })
    })
  );
  console.log("Telegram commands deleted successfully");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
