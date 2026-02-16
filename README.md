## Local webhook test (ngrok)

1. Run the server:
   - `pnpm dev`
2. Start ngrok and copy the HTTPS URL:
   - `ngrok http 3000`
3. Export webhook URL (append route):
   - `export PUBLIC_WEBHOOK_URL="https://<NGROK_HOST>/telegram/webhook"`
4. Register webhook with Telegram secret token:
   - `pnpm tg:webhook:set`
5. Check webhook status:
   - `pnpm tg:webhook:info`
6. Send `/start` to your bot in private chat and verify:
   - server returns HTTP 200 on `/telegram/webhook`
   - bot replies `OK`

## Telegram slash command setup

Set `/task` command for Telegram suggestions:

- `TELEGRAM_BOT_TOKEN=... pnpm tg:commands:set`

Verify in Telegram:

- Open bot chat, type `/` and confirm `/task` appears in suggestions.

Optional cleanup:

- `TELEGRAM_BOT_TOKEN=... pnpm tg:commands:delete`
