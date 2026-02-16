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
  method: "setWebhook" | "getWebhookInfo" | "deleteWebhook",
  body?: URLSearchParams
): Promise<TelegramResponse> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/x-www-form-urlencoded" } : {},
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
  const action = process.argv[2] as "set" | "info" | "delete" | undefined;
  if (!action || !["set", "info", "delete"].includes(action)) {
    throw new Error("Usage: tsx scripts/telegram-webhook.ts <set|info|delete>");
  }

  const token = requireEnv("TELEGRAM_BOT_TOKEN");

  if (action === "set") {
    const webhookUrl = requireEnv("PUBLIC_WEBHOOK_URL");
    const secretToken = requireEnv("TELEGRAM_WEBHOOK_SECRET_TOKEN");

    await callTelegram(
      token,
      "setWebhook",
      new URLSearchParams({
        url: webhookUrl,
        secret_token: secretToken
      })
    );

    console.log(`Webhook set: ${webhookUrl}`);
    return;
  }

  if (action === "info") {
    const result = await callTelegram(token, "getWebhookInfo");
    console.log("Webhook info:");
    console.log(JSON.stringify(result.result ?? {}, null, 2));
    return;
  }

  await callTelegram(token, "deleteWebhook");
  console.log("Webhook deleted");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
