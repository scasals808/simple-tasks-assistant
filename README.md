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

Export token:

- `export TELEGRAM_BOT_TOKEN=...`

Set commands for both default and group chats:

- `pnpm tg:commands:set`

Verify via API:

- `pnpm tg:commands:get`
- Confirm `task` appears in both scopes (`default`, `all_group_chats`).

Verify in Telegram UI:

- Reopen bot chat and group chat.
- Type `/` and confirm `/task` appears in suggestions.

Optional cleanup:

- `pnpm tg:commands:delete`
